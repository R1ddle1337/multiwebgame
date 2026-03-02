import { describe, expect, it } from 'vitest';

import { createInMemoryLoginLockout } from '../src/login-lockout.js';

describe('login lockout counters', () => {
  it('increments failures and locks once threshold is reached', async () => {
    const lockout = createInMemoryLoginLockout({
      maxFailures: 2,
      windowSeconds: 15 * 60,
      lockoutSeconds: 15 * 60
    });

    const firstFailure = await lockout.registerFailure('alice@example.com');
    expect(firstFailure.blocked).toBe(false);

    const secondFailure = await lockout.registerFailure('ALICE@example.com');
    expect(secondFailure.blocked).toBe(true);
    expect(secondFailure.retryAfterSeconds).toBeGreaterThan(0);

    const status = await lockout.check('alice@example.com');
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('clears counters after a successful login reset', async () => {
    const lockout = createInMemoryLoginLockout({
      maxFailures: 2,
      windowSeconds: 15 * 60,
      lockoutSeconds: 15 * 60
    });

    await lockout.registerFailure('alice@example.com');
    await lockout.clear('alice@example.com');

    const statusAfterClear = await lockout.check('alice@example.com');
    expect(statusAfterClear.blocked).toBe(false);

    const firstFailureAfterClear = await lockout.registerFailure('alice@example.com');
    expect(firstFailureAfterClear.blocked).toBe(false);
  });
});
