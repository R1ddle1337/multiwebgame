import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? undefined : '.env' });

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid environment variable ${name}: expected a positive integer`);
  }

  return value;
}

export const config = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  jwtSecret: requireEnv('JWT_SECRET', 'dev-only-insecure-secret'),
  databaseUrl: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/multiwebgame'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  loginMaxFailures: positiveIntEnv('LOGIN_MAX_FAILURES', 10),
  loginFailureWindowSeconds: positiveIntEnv('LOGIN_FAILURE_WINDOW_SECONDS', 15 * 60),
  loginLockoutSeconds: positiveIntEnv('LOGIN_LOCKOUT_SECONDS', 15 * 60)
};
