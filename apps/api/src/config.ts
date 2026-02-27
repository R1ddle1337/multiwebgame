import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'test' ? undefined : '.env' });

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  apiPort: Number(process.env.API_PORT ?? 4000),
  jwtSecret: requireEnv('JWT_SECRET', 'dev-only-insecure-secret'),
  databaseUrl: requireEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/multiwebgame'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173'
};
