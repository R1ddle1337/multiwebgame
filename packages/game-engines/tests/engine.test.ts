import { describe, expect, it } from 'vitest';

import {
  apply2048Move,
  applyGoMove,
  applyGomokuMove,
  applyXiangqiMove,
  create2048State,
  createGoState,
  createGomokuState,
  createXiangqiState
} from '../src/index.js';

describe('2048 engine', () => {
  it('spawns two tiles on initialization', () => {
    const state = create2048State(() => 0);
    const nonZero = state.board.flat().filter((value) => value !== 0);
    expect(nonZero).toHaveLength(2);
  });

  it('merges tiles when moving left', () => {
    const initial = {
      board: [
        [2, 2, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      score: 0,
      status: 'playing' as const
    };

    const { state, moved, scoreGain } = apply2048Move(initial, 'left', () => 0.9);
    expect(moved).toBe(true);
    expect(scoreGain).toBe(4);
    expect(state.score).toBe(4);
    expect(state.board[0][0]).toBe(4);
  });
});

describe('gomoku engine', () => {
  it('rejects out-of-turn moves', () => {
    const state = createGomokuState(15);
    const result = applyGomokuMove(state, { x: 0, y: 0, player: 'white' });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('out_of_turn');
  });

  it('rejects occupied cell moves', () => {
    let state = createGomokuState(15);
    const first = applyGomokuMove(state, { x: 3, y: 3, player: 'black' });
    state = first.nextState;

    const second = applyGomokuMove(state, { x: 3, y: 3, player: 'white' });
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('occupied_cell');
  });

  it('detects a horizontal winner', () => {
    let state = createGomokuState(15);

    const sequence = [
      { x: 0, y: 0, player: 'black' as const },
      { x: 0, y: 1, player: 'white' as const },
      { x: 1, y: 0, player: 'black' as const },
      { x: 1, y: 1, player: 'white' as const },
      { x: 2, y: 0, player: 'black' as const },
      { x: 2, y: 1, player: 'white' as const },
      { x: 3, y: 0, player: 'black' as const },
      { x: 3, y: 1, player: 'white' as const },
      { x: 4, y: 0, player: 'black' as const }
    ];

    for (const move of sequence) {
      const next = applyGomokuMove(state, move);
      state = next.nextState;
    }

    expect(state.winner).toBe('black');
    expect(state.status).toBe('completed');
  });
});

describe('go engine', () => {
  function play(state: ReturnType<typeof createGoState>, move: Parameters<typeof applyGoMove>[1]) {
    const result = applyGoMove(state, move);
    expect(result.accepted).toBe(true);
    return result.nextState;
  }

  it('captures a surrounded stone', () => {
    let state = createGoState(5);
    state = play(state, { type: 'place', x: 0, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 1, y: 1, player: 'white' });
    state = play(state, { type: 'place', x: 1, y: 0, player: 'black' });
    state = play(state, { type: 'place', x: 4, y: 4, player: 'white' });
    state = play(state, { type: 'place', x: 2, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 4, y: 3, player: 'white' });

    const capture = applyGoMove(state, { type: 'place', x: 1, y: 2, player: 'black' });
    expect(capture.accepted).toBe(true);
    expect(capture.nextState.board[1][1]).toBeNull();
  });

  it('rejects suicide moves', () => {
    let state = createGoState(5);
    state = play(state, { type: 'place', x: 0, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 4, y: 4, player: 'white' });
    state = play(state, { type: 'place', x: 1, y: 0, player: 'black' });
    state = play(state, { type: 'place', x: 4, y: 3, player: 'white' });
    state = play(state, { type: 'place', x: 2, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 3, y: 4, player: 'white' });
    state = play(state, { type: 'place', x: 1, y: 2, player: 'black' });

    const suicide = applyGoMove(state, { type: 'place', x: 1, y: 1, player: 'white' });
    expect(suicide.accepted).toBe(false);
    expect(suicide.reason).toBe('suicide_move');
    expect(suicide.nextState.board[1][1]).toBeNull();
  });

  it('rejects immediate ko recapture', () => {
    let state = createGoState(5);
    state = play(state, { type: 'place', x: 0, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 1, y: 1, player: 'white' });
    state = play(state, { type: 'place', x: 1, y: 0, player: 'black' });
    state = play(state, { type: 'place', x: 0, y: 2, player: 'white' });
    state = play(state, { type: 'place', x: 2, y: 1, player: 'black' });
    state = play(state, { type: 'place', x: 2, y: 2, player: 'white' });
    state = play(state, { type: 'place', x: 4, y: 4, player: 'black' });
    state = play(state, { type: 'place', x: 1, y: 3, player: 'white' });

    const capture = applyGoMove(state, { type: 'place', x: 1, y: 2, player: 'black' });
    expect(capture.accepted).toBe(true);
    expect(capture.nextState.koPoint).toEqual({ x: 1, y: 1 });

    const recapture = applyGoMove(capture.nextState, { type: 'place', x: 1, y: 1, player: 'white' });
    expect(recapture.accepted).toBe(false);
    expect(recapture.reason).toBe('ko_violation');
  });

  it('ends the match after two consecutive passes', () => {
    const initial = createGoState(5);

    const firstPass = applyGoMove(initial, { type: 'pass', player: 'black' });
    expect(firstPass.accepted).toBe(true);
    expect(firstPass.nextState.status).toBe('playing');
    expect(firstPass.nextState.consecutivePasses).toBe(1);

    const secondPass = applyGoMove(firstPass.nextState, { type: 'pass', player: 'white' });
    expect(secondPass.accepted).toBe(true);
    expect(secondPass.nextState.status).toBe('completed');
    expect(secondPass.nextState.consecutivePasses).toBe(2);
  });
});

type TestXiangqiColor = 'red' | 'black';
type TestXiangqiPieceType = 'general' | 'advisor' | 'elephant' | 'horse' | 'chariot' | 'cannon' | 'soldier';
type TestXiangqiPiece = { type: TestXiangqiPieceType; color: TestXiangqiColor };

function createEmptyXiangqiState(nextPlayer: TestXiangqiColor = 'red') {
  return {
    board: Array.from({ length: 10 }, () => Array.from({ length: 9 }, () => null as TestXiangqiPiece | null)),
    nextPlayer,
    status: 'playing' as const,
    winner: null as TestXiangqiColor | null,
    moveCount: 0
  };
}

function putPiece(
  state: ReturnType<typeof createEmptyXiangqiState>,
  x: number,
  y: number,
  type: TestXiangqiPieceType,
  color: TestXiangqiColor
) {
  state.board[y][x] = { type, color };
}

describe('xiangqi engine', () => {
  it('rejects out-of-turn moves', () => {
    const state = createXiangqiState();
    const result = applyXiangqiMove(state, {
      from: { x: 0, y: 3 },
      to: { x: 0, y: 4 },
      player: 'black'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('out_of_turn');
  });

  it('enforces palace constraints for advisors', () => {
    const state = createXiangqiState();
    const result = applyXiangqiMove(state, {
      from: { x: 3, y: 9 },
      to: { x: 2, y: 8 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('illegal_piece_movement');
  });

  it('enforces horse-leg blocking', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 5, 'soldier', 'red');
    putPiece(state, 1, 9, 'horse', 'red');
    putPiece(state, 1, 8, 'soldier', 'red');

    const result = applyXiangqiMove(state, {
      from: { x: 1, y: 9 },
      to: { x: 2, y: 7 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('illegal_piece_movement');
  });

  it('enforces elephant-eye blocking', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 5, 'soldier', 'red');
    putPiece(state, 2, 9, 'elephant', 'red');
    putPiece(state, 3, 8, 'soldier', 'red');

    const result = applyXiangqiMove(state, {
      from: { x: 2, y: 9 },
      to: { x: 4, y: 7 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('illegal_piece_movement');
  });

  it('enforces elephant river constraints', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 6, 'soldier', 'red');
    putPiece(state, 4, 5, 'elephant', 'red');

    const result = applyXiangqiMove(state, {
      from: { x: 4, y: 5 },
      to: { x: 2, y: 3 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('illegal_piece_movement');
  });

  it('enforces cannon capture screen rules', () => {
    const withoutScreen = createEmptyXiangqiState();
    putPiece(withoutScreen, 4, 9, 'general', 'red');
    putPiece(withoutScreen, 4, 0, 'general', 'black');
    putPiece(withoutScreen, 4, 5, 'soldier', 'red');
    putPiece(withoutScreen, 1, 7, 'cannon', 'red');
    putPiece(withoutScreen, 1, 3, 'soldier', 'black');

    const badCapture = applyXiangqiMove(withoutScreen, {
      from: { x: 1, y: 7 },
      to: { x: 1, y: 3 },
      player: 'red'
    });

    expect(badCapture.accepted).toBe(false);
    expect(badCapture.reason).toBe('illegal_piece_movement');

    const withScreen = createEmptyXiangqiState();
    putPiece(withScreen, 4, 9, 'general', 'red');
    putPiece(withScreen, 4, 0, 'general', 'black');
    putPiece(withScreen, 4, 5, 'soldier', 'red');
    putPiece(withScreen, 1, 7, 'cannon', 'red');
    putPiece(withScreen, 1, 5, 'soldier', 'red');
    putPiece(withScreen, 1, 3, 'soldier', 'black');

    const goodCapture = applyXiangqiMove(withScreen, {
      from: { x: 1, y: 7 },
      to: { x: 1, y: 3 },
      player: 'red'
    });

    expect(goodCapture.accepted).toBe(true);
    expect(goodCapture.nextState.board[3][1]).toEqual({ type: 'cannon', color: 'red' });
  });

  it('rejects moves that leave own general in check', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 5, 'chariot', 'red');

    const result = applyXiangqiMove(state, {
      from: { x: 4, y: 5 },
      to: { x: 5, y: 5 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('leaves_general_in_check');
  });

  it('supports flying general captures', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');

    const result = applyXiangqiMove(state, {
      from: { x: 4, y: 9 },
      to: { x: 4, y: 0 },
      player: 'red'
    });

    expect(result.accepted).toBe(true);
    expect(result.nextState.winner).toBe('red');
    expect(result.nextState.status).toBe('completed');
  });
});
