import {
  applyBattleshipMove,
  applyCardsMove,
  applyCodenamesDuetMove,
  applyConnect4Move,
  applyDominationMove,
  applyDotsMove,
  applyHexMove,
  applyLiarsDiceMove,
  applyLoveLetterMove,
  applyOnitamaMove,
  applyQuoridorMove,
  applyReversiMove,
  applySantoriniMove,
  applyYahtzeeMove,
  createBackgammonState,
  createConnect4State,
  createDominationState,
  createDotsState,
  createHexState,
  createQuoridorState,
  createReversiState,
  createSantoriniState,
  createYahtzeeState
} from '@multiwebgame/game-engines';
import { describe, expect, it } from 'vitest';

import {
  backgammonBotMove,
  battleshipBotMove,
  cardsBotMove,
  codenamesBotMove,
  connect4BotMove,
  createSeededRandom,
  createTrainingBattleshipState,
  createTrainingCardsState,
  createTrainingCodenamesState,
  createTrainingLiarsDiceState,
  createTrainingLoveLetterDeck,
  createTrainingLoveLetterState,
  createTrainingOnitamaState,
  dominationBotMove,
  dotsBotMove,
  generateCardsMoves,
  generateLoveLetterMoves,
  generateOnitamaMoves,
  hexBotMove,
  liarsDiceBotMove,
  loveLetterBotMove,
  onitamaBotMove,
  quoridorBotMove,
  reversiBotMove,
  santoriniBotMove,
  yahtzeeBotMove
} from './trainingBots';

function expectMoveCountProgress<T extends { moveCount: number }>(before: T, after: T): void {
  expect(after.moveCount).toBeGreaterThan(before.moveCount);
}

function expectNotThrow(fn: () => unknown): void {
  expect(fn).not.toThrow();
}

describe('training bots phase 1', () => {
  it('connect4 bot runs and accepts a move', () => {
    let state = createConnect4State();
    const first = applyConnect4Move(state, { column: 3, player: 'red' });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => connect4BotMove(state, createSeededRandom('phase1-connect4')));
    const next = connect4BotMove(state, createSeededRandom('phase1-connect4'));
    expectMoveCountProgress(state, next);
  });

  it('reversi bot runs and accepts a move', () => {
    let state = createReversiState();
    const first = applyReversiMove(state, { x: 2, y: 3, player: 'black' });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => reversiBotMove(state, createSeededRandom('phase1-reversi')));
    const next = reversiBotMove(state, createSeededRandom('phase1-reversi'));
    expectMoveCountProgress(state, next);
  });

  it('dots bot runs and accepts a move', () => {
    let state = createDotsState({ dotsX: 4, dotsY: 4 });
    const first = applyDotsMove(state, { orientation: 'h', x: 0, y: 0, player: 'black' });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => dotsBotMove(state, createSeededRandom('phase1-dots')));
    const next = dotsBotMove(state, createSeededRandom('phase1-dots'));
    expectMoveCountProgress(state, next);
  });

  it('hex bot runs and accepts a move', () => {
    let state = createHexState({ boardSize: 5 });
    const first = applyHexMove(state, { x: 0, y: 0, player: 'black' });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => hexBotMove(state, createSeededRandom('phase1-hex')));
    const next = hexBotMove(state, createSeededRandom('phase1-hex'));
    expectMoveCountProgress(state, next);
  });

  it('quoridor bot runs and accepts a move', () => {
    let state = createQuoridorState({ boardSize: 9, wallsPerPlayer: 10 });
    const first = applyQuoridorMove(state, {
      type: 'pawn',
      x: state.pawns.black.x,
      y: state.pawns.black.y + 1,
      player: 'black'
    });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => quoridorBotMove(state, createSeededRandom('phase1-quoridor')));
    const next = quoridorBotMove(state, createSeededRandom('phase1-quoridor'));
    expectMoveCountProgress(state, next);
  });

  it('santorini bot runs and accepts a setup move', () => {
    let state = createSantoriniState({ boardSize: 5 });
    const first = applySantoriniMove(state, {
      type: 'place',
      worker: 'a',
      x: 0,
      y: 0,
      player: 'black'
    });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => santoriniBotMove(state, createSeededRandom('phase1-santorini')));
    const next = santoriniBotMove(state, createSeededRandom('phase1-santorini'));
    expectMoveCountProgress(state, next);
  });

  it('domination bot runs and accepts a move', () => {
    let state = createDominationState({ boardSize: 5 });
    const first = applyDominationMove(state, { x: 2, y: 2, player: 'black' });
    expect(first.accepted).toBe(true);
    state = first.nextState;

    expectNotThrow(() => dominationBotMove(state, createSeededRandom('phase1-domination')));
    const next = dominationBotMove(state, createSeededRandom('phase1-domination'));
    expectMoveCountProgress(state, next);
  });
});

describe('training bots phase 2', () => {
  it('onitama bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-onitama');
    let state = createTrainingOnitamaState(rng);

    // Advance to white turn with a legal black move.
    const blackMoves = generateOnitamaMoves(state, 'black');
    let moved = false;
    for (const move of blackMoves) {
      const applied = applyOnitamaMove(state, move);
      if (!applied.accepted) {
        continue;
      }

      state = applied.nextState;
      moved = true;
      break;
    }
    expect(moved).toBe(true);

    expectNotThrow(() => onitamaBotMove(state, rng));
    const next = onitamaBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('battleship bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-battleship');
    let state = createTrainingBattleshipState(rng);

    const blackFire = applyBattleshipMove(state, {
      type: 'fire',
      x: 0,
      y: 0,
      player: 'black'
    });
    expect(blackFire.accepted).toBe(true);
    state = blackFire.nextState;

    expectNotThrow(() => battleshipBotMove(state, rng));
    const next = battleshipBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('yahtzee bot runs and accepts a move', () => {
    let state = createYahtzeeState({ startingPlayer: 'black' });
    const rolled = applyYahtzeeMove(state, { type: 'roll', player: 'black' }, () => 1);
    expect(rolled.accepted).toBe(true);
    state = rolled.nextState;

    const scored = applyYahtzeeMove(state, { type: 'score', category: 'chance', player: 'black' }, () => 1);
    expect(scored.accepted).toBe(true);
    state = scored.nextState;

    const rng = createSeededRandom('phase2-yahtzee');
    expectNotThrow(() => yahtzeeBotMove(state, rng));
    const next = yahtzeeBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('love letter bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-love-letter');
    let state = createTrainingLoveLetterState(rng);

    const blackMoves = generateLoveLetterMoves(state, 'black');
    let moved = false;
    for (const move of blackMoves) {
      const applied = applyLoveLetterMove(state, move, () => createTrainingLoveLetterDeck(rng));
      if (!applied.accepted) {
        continue;
      }

      state = applied.nextState;
      moved = true;
      break;
    }
    expect(moved).toBe(true);

    expectNotThrow(() => loveLetterBotMove(state, rng));
    const next = loveLetterBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('codenames bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-codenames');
    let state = createTrainingCodenamesState(rng);

    const clue = applyCodenamesDuetMove(state, {
      type: 'clue',
      word: 'signal',
      count: 1,
      player: 'black'
    });
    expect(clue.accepted).toBe(true);
    state = clue.nextState;

    expectNotThrow(() => codenamesBotMove(state, rng));
    const next = codenamesBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('cards bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-cards');
    let state = createTrainingCardsState(rng);

    // Advance to white turn with any accepted black move.
    const blackMoves = generateCardsMoves(state, 'black');
    let moved = false;
    for (const move of blackMoves) {
      const applied = applyCardsMove(state, move);
      if (!applied.accepted) {
        continue;
      }

      state = applied.nextState;
      moved = true;
      break;
    }
    expect(moved).toBe(true);

    expectNotThrow(() => cardsBotMove(state, rng));
    const next = cardsBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('liars dice bot runs and accepts a move', () => {
    const rng = createSeededRandom('phase2-liars');
    let state = createTrainingLiarsDiceState(rng);

    const blackBid = applyLiarsDiceMove(state, { type: 'bid', quantity: 1, face: 1, player: 'black' }, () =>
      rng.nextDie()
    );
    expect(blackBid.accepted).toBe(true);
    state = blackBid.nextState;

    expectNotThrow(() => liarsDiceBotMove(state, rng));
    const next = liarsDiceBotMove(state, rng);
    expectMoveCountProgress(state, next);
  });

  it('backgammon bot runs and applies or safely skips without crash', () => {
    const rng = createSeededRandom('phase2-backgammon');
    const state = {
      ...createBackgammonState(),
      nextPlayer: 'black' as const,
      dice: [1, 2] as [number, number],
      remainingDice: [1, 2]
    };

    expectNotThrow(() => backgammonBotMove(state, rng));
    const next = backgammonBotMove(state, rng);
    expect(next.status === 'playing' || next.status === 'completed').toBe(true);
  });
});
