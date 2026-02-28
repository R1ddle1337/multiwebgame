import { describe, expect, it } from 'vitest';

import {
  applyPlayerCommit,
  applyPlayerReveal,
  buildRngPayload,
  createPlayerNonceCommit,
  createSeedCommit,
  createServerSeedHex,
  createVerifiableRngSession,
  deriveRngSeed,
  isRevealTimedOut,
  sha256Hex,
  verifyPlayerNonceCommit
} from '../src/verifiable-rng.js';

describe('verifiable rng utilities', () => {
  it('creates a 32-byte server seed in hex', () => {
    const seed = createServerSeedHex();
    expect(seed).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computes stable commits', () => {
    const commit = createSeedCommit('00'.repeat(32));
    const nonceCommit = createPlayerNonceCommit('nonce-a');

    expect(commit).toBe(sha256Hex(Buffer.from('00'.repeat(32), 'hex')));
    expect(nonceCommit).toBe(sha256Hex('nonce-a'));
    expect(verifyPlayerNonceCommit(nonceCommit, 'nonce-a')).toBe(true);
    expect(verifyPlayerNonceCommit(nonceCommit, 'nonce-b')).toBe(false);
  });

  it('derives deterministic rng seeds from full transcript', () => {
    const first = deriveRngSeed({
      serverSeedHex: 'ab'.repeat(32),
      nonceP1: 'player-1-secret',
      nonceP2: 'player-2-secret',
      matchId: '11111111-2222-3333-4444-555555555555'
    });
    const second = deriveRngSeed({
      serverSeedHex: 'ab'.repeat(32),
      nonceP1: 'player-1-secret',
      nonceP2: 'player-2-secret',
      matchId: '11111111-2222-3333-4444-555555555555'
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
  });

  it('completes commit-reveal flow and derives rngSeed', () => {
    const seeded = createVerifiableRngSession({
      matchId: '11111111-2222-3333-4444-555555555555',
      playerOneUserId: 'u1',
      playerTwoUserId: 'u2',
      serverSeedHex: 'ab'.repeat(32),
      revealTimeoutMs: 12_000
    });

    expect(seeded.serverSeedCommit).toBe(createSeedCommit('ab'.repeat(32)));
    expect(seeded.phase).toBe('awaiting_commits');

    const committedU1 = applyPlayerCommit(seeded, 'u1', createPlayerNonceCommit('nonce-u1'), 1000);
    expect(committedU1.accepted).toBe(true);
    expect(committedU1.session.phase).toBe('awaiting_commits');

    const committedU2 = applyPlayerCommit(
      committedU1.session,
      'u2',
      createPlayerNonceCommit('nonce-u2'),
      1500
    );
    expect(committedU2.accepted).toBe(true);
    expect(committedU2.session.phase).toBe('awaiting_reveals');
    expect(committedU2.session.revealDeadlineAt).toBe(13_500);

    const revealedU2 = applyPlayerReveal(committedU2.session, 'u2', 'nonce-u2');
    expect(revealedU2.accepted).toBe(true);
    expect(revealedU2.session.phase).toBe('awaiting_reveals');

    const revealedU1 = applyPlayerReveal(revealedU2.session, 'u1', 'nonce-u1');
    expect(revealedU1.accepted).toBe(true);
    expect(revealedU1.session.phase).toBe('ready');
    expect(revealedU1.session.rngSeed).toBe(
      deriveRngSeed({
        serverSeedHex: 'ab'.repeat(32),
        nonceP1: 'nonce-u1',
        nonceP2: 'nonce-u2',
        matchId: '11111111-2222-3333-4444-555555555555'
      })
    );

    expect(buildRngPayload(revealedU1.session)).toEqual({
      serverSeed: 'ab'.repeat(32),
      serverSeedCommit: createSeedCommit('ab'.repeat(32)),
      commits: {
        u1: createPlayerNonceCommit('nonce-u1'),
        u2: createPlayerNonceCommit('nonce-u2')
      },
      nonces: {
        u1: 'nonce-u1',
        u2: 'nonce-u2'
      },
      rngSeed: revealedU1.session.rngSeed
    });
  });

  it('rejects reveal mismatches and detects timeout', () => {
    const seeded = createVerifiableRngSession({
      matchId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      playerOneUserId: 'u1',
      playerTwoUserId: 'u2',
      serverSeedHex: 'cd'.repeat(32),
      revealTimeoutMs: 5000
    });

    const commit1 = applyPlayerCommit(seeded, 'u1', createPlayerNonceCommit('u1-secret'), 10);
    const commit2 = applyPlayerCommit(commit1.session, 'u2', createPlayerNonceCommit('u2-secret'), 20);
    expect(commit2.session.phase).toBe('awaiting_reveals');

    const mismatch = applyPlayerReveal(commit2.session, 'u1', 'wrong-secret');
    expect(mismatch.accepted).toBe(false);
    expect(mismatch.reason).toBe('commit_mismatch');

    expect(isRevealTimedOut(commit2.session, 5019)).toBe(false);
    expect(isRevealTimedOut(commit2.session, 5020)).toBe(true);
  });
});
