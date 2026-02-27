import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { pool } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResolveMigrationDirOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  scriptDir?: string;
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

async function isDirectory(targetPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export function getMigrationDirCandidates(options: ResolveMigrationDirOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const scriptDir = options.scriptDir ?? __dirname;
  const env = options.env ?? process.env;

  const configuredDir = env.MIGRATIONS_DIR?.trim();
  const configuredCandidate = configuredDir ? path.resolve(cwd, configuredDir) : null;

  return uniquePaths(
    [
      configuredCandidate,
      path.resolve(scriptDir, '../../../../infra/db/migrations'),
      path.resolve(scriptDir, '../../../infra/db/migrations'),
      path.resolve(cwd, 'infra/db/migrations'),
      path.resolve(cwd, '../infra/db/migrations'),
      path.resolve(cwd, '../../infra/db/migrations')
    ].filter((candidate): candidate is string => Boolean(candidate))
  );
}

export async function resolveMigrationDir(options: ResolveMigrationDirOptions = {}): Promise<string> {
  const candidates = getMigrationDirCandidates(options);

  for (const candidate of candidates) {
    if (await isDirectory(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Migration directory not found. Tried: ${candidates.join(', ')}`);
}

export async function runMigrations(): Promise<void> {
  const migrationDir = await resolveMigrationDir();
  const files = (await fs.readdir(migrationDir)).filter((name) => name.endsWith('.sql')).sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedResult = await pool.query<{ filename: string }>('SELECT filename FROM schema_migrations');
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

async function main(): Promise<void> {
  try {
    await runMigrations();
  } catch (error) {
    console.error('Migration failure', error);
    await pool.end();
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedAsScript) {
  void main();
}
