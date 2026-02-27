import { mkdtemp, mkdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { getMigrationDirCandidates, resolveMigrationDir } from '../src/scripts/migrate.js';

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'mwg-migrate-test-'));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('migration path resolution', () => {
  it('prefers MIGRATIONS_DIR when provided', async () => {
    const root = await makeTempRoot();
    const cwd = path.join(root, 'apps/api');
    const configured = path.join(cwd, 'custom/migrations');

    await mkdir(configured, { recursive: true });

    const resolved = await resolveMigrationDir({
      cwd,
      scriptDir: path.join(root, 'scripts'),
      env: { MIGRATIONS_DIR: 'custom/migrations' }
    });

    expect(resolved).toBe(configured);
  });

  it('resolves infra migrations from script-relative layout', async () => {
    const root = await makeTempRoot();
    const scriptDir = path.join(root, 'apps/api/src/scripts');
    const migrations = path.join(root, 'infra/db/migrations');

    await mkdir(scriptDir, { recursive: true });
    await mkdir(migrations, { recursive: true });

    const resolved = await resolveMigrationDir({
      cwd: path.join(root, 'apps/api'),
      scriptDir
    });

    expect(resolved).toBe(migrations);
  });

  it('falls back to cwd-based paths for workspace package execution', async () => {
    const root = await makeTempRoot();
    const cwd = path.join(root, 'apps/api');
    const migrations = path.join(root, 'infra/db/migrations');

    await mkdir(cwd, { recursive: true });
    await mkdir(migrations, { recursive: true });

    const resolved = await resolveMigrationDir({
      cwd,
      scriptDir: path.join(root, 'non-existent/scripts')
    });

    expect(resolved).toBe(migrations);
  });

  it('surfaces attempted paths when no migration directory exists', async () => {
    const root = await makeTempRoot();
    const cwd = path.join(root, 'apps/api');
    const scriptDir = path.join(root, 'apps/api/src/scripts');
    await mkdir(scriptDir, { recursive: true });

    const candidates = getMigrationDirCandidates({ cwd, scriptDir });
    await expect(resolveMigrationDir({ cwd, scriptDir })).rejects.toThrow('Migration directory not found');
    await expect(resolveMigrationDir({ cwd, scriptDir })).rejects.toThrow(candidates[0]);
  });
});
