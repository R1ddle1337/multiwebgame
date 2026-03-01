import { describe, expect, it } from 'vitest';
import {
  ONITAMA_CARDS,
  applyCodenamesDuetMove,
  applyOnitamaMove,
  createCodenamesDuetKeyPair,
  createCodenamesDuetState,
  createCodenamesDuetWordPool,
  createDeterministicPrng,
  createOnitamaCardPool,
  createOnitamaState
} from '@multiwebgame/game-engines';

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

  it('replays onitama opening cards and moves deterministically from rng proof', () => {
    const session = createVerifiableRngSession({
      matchId: '00000000-1111-2222-3333-444444444444',
      playerOneUserId: 'u1',
      playerTwoUserId: 'u2',
      serverSeedHex: '11'.repeat(32),
      revealTimeoutMs: 10_000
    });
    const committed = applyPlayerCommit(session, 'u1', createPlayerNonceCommit('onitama-1'), 100);
    const committedBoth = applyPlayerCommit(
      committed.session,
      'u2',
      createPlayerNonceCommit('onitama-2'),
      101
    );
    const revealed = applyPlayerReveal(committedBoth.session, 'u1', 'onitama-1');
    const ready = applyPlayerReveal(revealed.session, 'u2', 'onitama-2');
    expect(ready.accepted).toBe(true);
    expect(ready.session.phase).toBe('ready');

    const rngSeed = ready.session.rngSeed!;
    const vectorsByCard = Object.fromEntries(
      ONITAMA_CARDS.map((card) => [card.name, card.vectors])
    ) as Record<string, Array<{ dx: number; dy: number }>>;

    const replayOnce = () => {
      const prng = createDeterministicPrng(rngSeed);
      const pool = createOnitamaCardPool();
      prng.shuffleInPlace(pool);
      const openingCards = pool.slice(0, 5);
      let state = createOnitamaState({ openingCards });

      let chosenMove: Parameters<typeof applyOnitamaMove>[1] | null = null;
      outer: for (let y = 0; y < state.boardSize; y += 1) {
        for (let x = 0; x < state.boardSize; x += 1) {
          const piece = state.board[y][x];
          if (!piece || piece.player !== state.nextPlayer) {
            continue;
          }
          for (const card of state.cards[state.nextPlayer]) {
            const vectors = vectorsByCard[card] ?? [];
            for (const vector of vectors) {
              const dx = state.nextPlayer === 'black' ? vector.dx : -vector.dx;
              const dy = state.nextPlayer === 'black' ? vector.dy : -vector.dy;
              const toX = x + dx;
              const toY = y + dy;
              if (toX < 0 || toY < 0 || toX >= state.boardSize || toY >= state.boardSize) {
                continue;
              }
              const target = state.board[toY][toX];
              if (target?.player === state.nextPlayer) {
                continue;
              }
              chosenMove = {
                from: { x, y },
                to: { x: toX, y: toY },
                card,
                player: state.nextPlayer
              };
              break outer;
            }
          }
        }
      }

      expect(chosenMove).not.toBeNull();
      const applied = applyOnitamaMove(state, chosenMove!);
      expect(applied.accepted).toBe(true);
      state = applied.nextState;

      return {
        openingCards,
        state
      };
    };

    const first = replayOnce();
    const second = replayOnce();

    expect(first.openingCards).toEqual(second.openingCards);
    expect(first.state).toEqual(second.state);
  });

  it('replays codenames duet setup and guesses deterministically from rng proof', () => {
    const session = createVerifiableRngSession({
      matchId: '99999999-8888-7777-6666-555555555555',
      playerOneUserId: 'u1',
      playerTwoUserId: 'u2',
      serverSeedHex: '22'.repeat(32),
      revealTimeoutMs: 10_000
    });
    const committed = applyPlayerCommit(session, 'u1', createPlayerNonceCommit('codenames-1'), 200);
    const committedBoth = applyPlayerCommit(
      committed.session,
      'u2',
      createPlayerNonceCommit('codenames-2'),
      201
    );
    const revealed = applyPlayerReveal(committedBoth.session, 'u1', 'codenames-1');
    const ready = applyPlayerReveal(revealed.session, 'u2', 'codenames-2');
    expect(ready.accepted).toBe(true);
    expect(ready.session.phase).toBe('ready');

    const rngSeed = ready.session.rngSeed!;
    const replayOnce = () => {
      const prng = createDeterministicPrng(rngSeed);
      const words = createCodenamesDuetWordPool();
      prng.shuffleInPlace(words);
      const { keyBlack, keyWhite } = createCodenamesDuetKeyPair((items) => {
        prng.shuffleInPlace(items);
      });

      let state = createCodenamesDuetState({
        words: words.slice(0, 25),
        keyBlack,
        keyWhite,
        turns: 9
      });

      const clue = applyCodenamesDuetMove(state, {
        type: 'clue',
        word: 'seed',
        count: 1,
        player: 'black'
      });
      expect(clue.accepted).toBe(true);
      state = clue.nextState;

      const guessIndex = keyBlack.findIndex((role) => role === 'agent');
      expect(guessIndex).toBeGreaterThanOrEqual(0);
      const guess = applyCodenamesDuetMove(state, {
        type: 'guess',
        index: guessIndex,
        player: 'white'
      });
      expect(guess.accepted).toBe(true);
      state = guess.nextState;

      return {
        words: words.slice(0, 25),
        keyBlack,
        keyWhite,
        state
      };
    };

    const first = replayOnce();
    const second = replayOnce();

    expect(first.words).toEqual(second.words);
    expect(first.keyBlack).toEqual(second.keyBlack);
    expect(first.keyWhite).toEqual(second.keyWhite);
    expect(first.state).toEqual(second.state);
  });
});
