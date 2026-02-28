import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? undefined : '.env' });

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
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
  realtimePort: Number(process.env.REALTIME_PORT ?? 4001),
  databaseUrl: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/multiwebgame'),
  jwtSecret: requireEnv('JWT_SECRET', 'dev-only-insecure-secret'),
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  roomIdleCloseMinutes: positiveIntEnv('ROOM_IDLE_CLOSE_MINUTES', 30),
  roomIdleCloseSweepMinutes: positiveIntEnv('ROOM_IDLE_CLOSE_SWEEP_MINUTES', 5)
};
