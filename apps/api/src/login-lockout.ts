import { Redis as RedisClient } from 'ioredis';

export interface LoginLockoutState {
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface LoginLockoutService {
  check(email: string, ipAddress?: string | null): Promise<LoginLockoutState>;
  registerFailure(email: string, ipAddress?: string | null): Promise<LoginLockoutState>;
  clear(email: string, ipAddress?: string | null): Promise<void>;
}

export interface LoginLockoutOptions {
  maxFailures?: number;
  windowSeconds?: number;
  lockoutSeconds?: number;
  keyPrefix?: string;
  redisUrl?: string;
}

interface ResolvedLoginLockoutOptions {
  maxFailures: number;
  windowSeconds: number;
  lockoutSeconds: number;
  keyPrefix: string;
}

interface LoginFailureEntry {
  failureCount: number;
  windowEndsAtMs: number;
  lockoutEndsAtMs: number;
}

const DEFAULT_MAX_FAILURES = 10;
const DEFAULT_WINDOW_SECONDS = 15 * 60;
const DEFAULT_LOCKOUT_SECONDS = 15 * 60;
const DEFAULT_PREFIX = 'mwg:auth';

function parsePositiveInt(value: number | undefined, fallback: number, fieldName: string): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function resolveOptions(options: LoginLockoutOptions): ResolvedLoginLockoutOptions {
  return {
    maxFailures: parsePositiveInt(options.maxFailures, DEFAULT_MAX_FAILURES, 'maxFailures'),
    windowSeconds: parsePositiveInt(options.windowSeconds, DEFAULT_WINDOW_SECONDS, 'windowSeconds'),
    lockoutSeconds: parsePositiveInt(options.lockoutSeconds, DEFAULT_LOCKOUT_SECONDS, 'lockoutSeconds'),
    keyPrefix: options.keyPrefix?.trim() || DEFAULT_PREFIX
  };
}

function retryAfterSeconds(lockedUntilMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((lockedUntilMs - nowMs) / 1000));
}

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createInMemoryLoginLockout(options: LoginLockoutOptions = {}): LoginLockoutService {
  const settings = resolveOptions(options);
  const entries = new Map<string, LoginFailureEntry>();

  function getEntry(email: string): LoginFailureEntry {
    const entry = entries.get(email);
    if (entry) {
      return entry;
    }

    const created: LoginFailureEntry = {
      failureCount: 0,
      windowEndsAtMs: 0,
      lockoutEndsAtMs: 0
    };
    entries.set(email, created);
    return created;
  }

  function normalizeEntry(entry: LoginFailureEntry, nowMs: number): void {
    if (entry.lockoutEndsAtMs > 0 && entry.lockoutEndsAtMs <= nowMs) {
      entry.lockoutEndsAtMs = 0;
    }

    if (entry.windowEndsAtMs > 0 && entry.windowEndsAtMs <= nowMs) {
      entry.failureCount = 0;
      entry.windowEndsAtMs = 0;
    }
  }

  function currentStatus(entry: LoginFailureEntry, nowMs: number): LoginLockoutState {
    if (entry.lockoutEndsAtMs > nowMs) {
      return {
        blocked: true,
        retryAfterSeconds: retryAfterSeconds(entry.lockoutEndsAtMs, nowMs)
      };
    }

    return {
      blocked: false,
      retryAfterSeconds: 0
    };
  }

  return {
    async check(email) {
      const normalizedEmail = normalizeLoginEmail(email);
      const entry = entries.get(normalizedEmail);
      if (!entry) {
        return {
          blocked: false,
          retryAfterSeconds: 0
        };
      }

      const nowMs = Date.now();
      normalizeEntry(entry, nowMs);
      const status = currentStatus(entry, nowMs);
      if (!status.blocked && entry.failureCount === 0 && entry.windowEndsAtMs === 0) {
        entries.delete(normalizedEmail);
      }
      return status;
    },
    async registerFailure(email) {
      const normalizedEmail = normalizeLoginEmail(email);
      const nowMs = Date.now();
      const entry = getEntry(normalizedEmail);

      normalizeEntry(entry, nowMs);
      const status = currentStatus(entry, nowMs);
      if (status.blocked) {
        return status;
      }

      entry.failureCount = entry.windowEndsAtMs > nowMs ? entry.failureCount + 1 : 1;
      entry.windowEndsAtMs = nowMs + settings.windowSeconds * 1000;

      if (entry.failureCount >= settings.maxFailures) {
        entry.failureCount = 0;
        entry.windowEndsAtMs = 0;
        entry.lockoutEndsAtMs = nowMs + settings.lockoutSeconds * 1000;
        return {
          blocked: true,
          retryAfterSeconds: settings.lockoutSeconds
        };
      }

      return {
        blocked: false,
        retryAfterSeconds: 0
      };
    },
    async clear(email) {
      const normalizedEmail = normalizeLoginEmail(email);
      entries.delete(normalizedEmail);
    }
  };
}

class RedisBackedLoginLockout implements LoginLockoutService {
  private readonly fallback: LoginLockoutService;

  private readonly redis: RedisClient | null;

  private connectPromise: Promise<void> | null = null;

  private redisUnavailable = false;

  private hasLoggedUnavailable = false;

  constructor(
    private readonly options: ResolvedLoginLockoutOptions,
    redisUrl?: string
  ) {
    this.fallback = createInMemoryLoginLockout(options);
    this.redis = redisUrl
      ? new RedisClient(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 500
        })
      : null;

    if (!this.redis) {
      this.redisUnavailable = true;
    }
  }

  private failureKey(email: string): string {
    return `${this.options.keyPrefix}:login:fail:${email}`;
  }

  private lockoutKey(email: string): string {
    return `${this.options.keyPrefix}:login:lock:${email}`;
  }

  private logRedisUnavailable(error: unknown): void {
    if (this.hasLoggedUnavailable) {
      return;
    }
    this.hasLoggedUnavailable = true;
    console.warn(
      'API login lockout Redis unavailable, falling back to in-memory counters',
      error instanceof Error ? error.message : 'unknown_error'
    );
  }

  private async ensureConnected(): Promise<boolean> {
    if (this.redisUnavailable || !this.redis) {
      return false;
    }

    if (this.redis.status === 'ready') {
      return true;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.redis
        .connect()
        .catch((error: unknown) => {
          this.redisUnavailable = true;
          this.logRedisUnavailable(error);
          throw error;
        })
        .finally(() => {
          this.connectPromise = null;
        });
    }

    try {
      await this.connectPromise;
      return true;
    } catch {
      return false;
    }
  }

  private async withStore<T>(
    runRedis: (redis: RedisClient) => Promise<T>,
    runFallback: () => Promise<T>
  ): Promise<T> {
    if (!(await this.ensureConnected()) || !this.redis) {
      return runFallback();
    }

    try {
      return await runRedis(this.redis);
    } catch (error) {
      this.redisUnavailable = true;
      this.logRedisUnavailable(error);
      return runFallback();
    }
  }

  private async readRedisLockStatus(redis: RedisClient, normalizedEmail: string): Promise<LoginLockoutState> {
    const ttl = await redis.ttl(this.lockoutKey(normalizedEmail));
    if (ttl > 0) {
      return {
        blocked: true,
        retryAfterSeconds: ttl
      };
    }

    if (ttl === -1) {
      await redis.expire(this.lockoutKey(normalizedEmail), this.options.lockoutSeconds);
      return {
        blocked: true,
        retryAfterSeconds: this.options.lockoutSeconds
      };
    }

    return {
      blocked: false,
      retryAfterSeconds: 0
    };
  }

  async check(email: string): Promise<LoginLockoutState> {
    const normalizedEmail = normalizeLoginEmail(email);
    return this.withStore(
      (redis) => this.readRedisLockStatus(redis, normalizedEmail),
      () => this.fallback.check(normalizedEmail)
    );
  }

  async registerFailure(email: string): Promise<LoginLockoutState> {
    const normalizedEmail = normalizeLoginEmail(email);
    return this.withStore(
      async (redis) => {
        const lockStatus = await this.readRedisLockStatus(redis, normalizedEmail);
        if (lockStatus.blocked) {
          return lockStatus;
        }

        const transactionResult = await redis
          .multi()
          .incr(this.failureKey(normalizedEmail))
          .expire(this.failureKey(normalizedEmail), this.options.windowSeconds)
          .exec();
        const rawCount = transactionResult?.[0]?.[1];
        const attemptCount = typeof rawCount === 'number' ? rawCount : Number(rawCount ?? 0);

        if (attemptCount >= this.options.maxFailures) {
          await redis
            .multi()
            .set(this.lockoutKey(normalizedEmail), '1', 'EX', this.options.lockoutSeconds)
            .del(this.failureKey(normalizedEmail))
            .exec();
          return {
            blocked: true,
            retryAfterSeconds: this.options.lockoutSeconds
          };
        }

        return {
          blocked: false,
          retryAfterSeconds: 0
        };
      },
      () => this.fallback.registerFailure(normalizedEmail)
    );
  }

  async clear(email: string): Promise<void> {
    const normalizedEmail = normalizeLoginEmail(email);
    await this.withStore(
      async (redis) => {
        await redis.del(this.failureKey(normalizedEmail), this.lockoutKey(normalizedEmail));
      },
      () => this.fallback.clear(normalizedEmail)
    );
  }
}

export function createRedisBackedLoginLockout(options: LoginLockoutOptions = {}): LoginLockoutService {
  const resolved = resolveOptions(options);
  return new RedisBackedLoginLockout(resolved, options.redisUrl);
}
