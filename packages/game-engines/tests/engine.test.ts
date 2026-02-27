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

  it('merges deterministic pairs once per move', () => {
    const initial = {
      board: [
        [2, 2, 2, 2],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      score: 0,
      status: 'playing' as const
    };

    const { state, moved, scoreGain, spawnedTile } = apply2048Move(initial, 'left', () => 0, {
      row: 1,
      col: 0,
      value: 2
    });

    expect(moved).toBe(true);
    expect(scoreGain).toBe(8);
    expect(state.score).toBe(8);
    expect(state.board[0]).toEqual([4, 4, 0, 0]);
    expect(spawnedTile).toEqual({ row: 1, col: 0, value: 2 });
  });

  it('does not spawn a tile when no movement occurs and marks terminal loss', () => {
    const initial = {
      board: [
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 8]
      ],
      score: 10,
      status: 'playing' as const
    };

    const { state, moved, scoreGain, spawnedTile } = apply2048Move(initial, 'left', () => 0.1);

    expect(moved).toBe(false);
    expect(scoreGain).toBe(0);
    expect(spawnedTile).toBeNull();
    expect(state.board).toEqual(initial.board);
    expect(state.status).toBe('lost');
  });

  it('locks the game in won state when reaching 2048', () => {
    const initial = {
      board: [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
      ],
      score: 0,
      status: 'playing' as const
    };

    const won = apply2048Move(initial, 'left', () => 0, { row: 1, col: 0, value: 2 });
    expect(won.state.status).toBe('won');

    const second = apply2048Move(won.state, 'right', () => 0);
    expect(second.moved).toBe(false);
    expect(second.state).toEqual(won.state);
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

  it('detects freestyle overline as a win', () => {
    let state = createGomokuState({ boardSize: 15, ruleset: 'freestyle' });

    const sequence = [
      { x: 0, y: 0, player: 'black' as const },
      { x: 0, y: 1, player: 'white' as const },
      { x: 1, y: 0, player: 'black' as const },
      { x: 1, y: 1, player: 'white' as const },
      { x: 2, y: 0, player: 'black' as const },
      { x: 2, y: 1, player: 'white' as const },
      { x: 3, y: 0, player: 'black' as const },
      { x: 3, y: 1, player: 'white' as const },
      { x: 4, y: 0, player: 'black' as const },
      { x: 4, y: 1, player: 'white' as const },
      { x: 5, y: 0, player: 'black' as const }
    ];

    for (const move of sequence) {
      const next = applyGomokuMove(state, move);
      state = next.nextState;
    }

    expect(state.winner).toBe('black');
    expect(state.status).toBe('completed');
  });

  it('enforces renju overline restriction for black', () => {
    const state = createGomokuState({ boardSize: 15, ruleset: 'renju' });
    const board = state.board.map((row) => [...row]);

    board[7][2] = 'black';
    board[7][3] = 'black';
    board[7][4] = 'black';
    board[7][5] = 'black';
    board[7][7] = 'black';

    const customState = {
      ...state,
      board,
      nextPlayer: 'black' as const,
      moveCount: 5
    };

    const result = applyGomokuMove(customState, { x: 6, y: 7, player: 'black' });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('forbidden_overline');
  });

  it('enforces renju double-three restriction for black', () => {
    const state = createGomokuState({ boardSize: 15, ruleset: 'renju' });
    const board = state.board.map((row) => [...row]);

    board[7][6] = 'black';
    board[7][8] = 'black';
    board[6][7] = 'black';
    board[8][7] = 'black';

    const customState = {
      ...state,
      board,
      nextPlayer: 'black' as const,
      moveCount: 4
    };

    const result = applyGomokuMove(customState, { x: 7, y: 7, player: 'black' });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('forbidden_double_three');
  });

  it('enforces renju double-four restriction for black', () => {
    const state = createGomokuState({ boardSize: 15, ruleset: 'renju' });
    const board = state.board.map((row) => [...row]);

    board[7][5] = 'black';
    board[7][6] = 'black';
    board[7][8] = 'black';
    board[5][7] = 'black';
    board[6][7] = 'black';
    board[8][7] = 'black';

    const customState = {
      ...state,
      board,
      nextPlayer: 'black' as const,
      moveCount: 6
    };

    const result = applyGomokuMove(customState, { x: 7, y: 7, player: 'black' });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('forbidden_double_four');
  });

  it('allows white to win with overline in renju mode', () => {
    const state = createGomokuState({ boardSize: 15, ruleset: 'renju' });
    const board = state.board.map((row) => [...row]);

    board[10][2] = 'white';
    board[10][3] = 'white';
    board[10][4] = 'white';
    board[10][5] = 'white';
    board[10][7] = 'white';

    const customState = {
      ...state,
      board,
      nextPlayer: 'white' as const,
      moveCount: 5
    };

    const result = applyGomokuMove(customState, { x: 6, y: 10, player: 'white' });

    expect(result.accepted).toBe(true);
    expect(result.nextState.winner).toBe('white');
    expect(result.nextState.status).toBe('completed');
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
    expect(capture.nextState.captures.black).toBe(1);
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

  it('calculates Chinese area scoring after two passes', () => {
    const state = createGoState({ boardSize: 3, komi: 0.5 });

    state.board = [
      ['black', 'black', 'black'],
      ['black', null, 'black'],
      ['black', 'black', 'black']
    ];
    state.nextPlayer = 'black';

    const firstPass = applyGoMove(state, { type: 'pass', player: 'black' });
    expect(firstPass.accepted).toBe(true);
    expect(firstPass.nextState.status).toBe('playing');

    const secondPass = applyGoMove(firstPass.nextState, { type: 'pass', player: 'white' });
    expect(secondPass.accepted).toBe(true);
    expect(secondPass.nextState.status).toBe('completed');
    expect(secondPass.nextState.winner).toBe('black');
    expect(secondPass.nextState.scoring).not.toBeNull();
    expect(secondPass.nextState.scoring?.black.territory).toBe(1);
    expect(secondPass.nextState.scoring?.white.total).toBe(0.5);
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
    outcomeReason: null,
    moveCount: 0,
    positionHistory: ['seed-position']
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

  it('enforces palace constraints for generals', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 5, 'soldier', 'red');

    const result = applyXiangqiMove(state, {
      from: { x: 4, y: 9 },
      to: { x: 4, y: 6 },
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

  it('rejects cannon captures with multiple screens', () => {
    const state = createEmptyXiangqiState();
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 1, 7, 'cannon', 'red');
    putPiece(state, 1, 6, 'soldier', 'red');
    putPiece(state, 1, 5, 'soldier', 'black');
    putPiece(state, 1, 3, 'soldier', 'black');

    const result = applyXiangqiMove(state, {
      from: { x: 1, y: 7 },
      to: { x: 1, y: 3 },
      player: 'red'
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('illegal_piece_movement');
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

  it('rejects exposing facing generals', () => {
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
    expect(result.nextState.outcomeReason).toBe('capture_general');
  });

  it('detects checkmate when opponent has no legal response', () => {
    const state = createEmptyXiangqiState('red');
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 2, 'chariot', 'red');
    putPiece(state, 3, 1, 'chariot', 'red');
    putPiece(state, 5, 1, 'chariot', 'red');
    putPiece(state, 2, 2, 'horse', 'red');

    putPiece(state, 4, 0, 'general', 'black');

    const result = applyXiangqiMove(state, {
      from: { x: 4, y: 2 },
      to: { x: 4, y: 1 },
      player: 'red'
    });

    expect(result.accepted).toBe(true);
    expect(result.nextState.status).toBe('completed');
    expect(result.nextState.winner).toBe('red');
    expect(result.nextState.outcomeReason).toBe('checkmate');
  });

  it('detects stalemate when opponent has no legal move but is not in check', () => {
    const state = createEmptyXiangqiState('red');
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 0, 6, 'soldier', 'red');
    putPiece(state, 3, 2, 'chariot', 'red');
    putPiece(state, 5, 2, 'chariot', 'red');
    putPiece(state, 4, 3, 'cannon', 'red');
    putPiece(state, 4, 2, 'soldier', 'red');
    putPiece(state, 3, 0, 'elephant', 'red');
    putPiece(state, 4, 1, 'advisor', 'red');
    putPiece(state, 5, 0, 'elephant', 'red');

    putPiece(state, 4, 0, 'general', 'black');

    const result = applyXiangqiMove(state, {
      from: { x: 0, y: 6 },
      to: { x: 0, y: 5 },
      player: 'red'
    });

    expect(result.accepted).toBe(true);
    expect(result.nextState.status).toBe('completed');
    expect(result.nextState.winner).toBe('red');
    expect(result.nextState.outcomeReason).toBe('stalemate');
  });

  it('applies deterministic draw policy on non-check threefold repetition', () => {
    const state = createEmptyXiangqiState('red');
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 0, 9, 'chariot', 'red');
    putPiece(state, 4, 5, 'soldier', 'red');

    const move = {
      from: { x: 0, y: 9 },
      to: { x: 0, y: 8 },
      player: 'red' as const
    };

    const first = applyXiangqiMove(state, move);
    expect(first.accepted).toBe(true);

    const nextHash = first.nextState.positionHistory[first.nextState.positionHistory.length - 1] ?? '';
    const repeatedState = {
      ...state,
      positionHistory: [nextHash, nextHash]
    };

    const repeated = applyXiangqiMove(repeatedState, move);
    expect(repeated.accepted).toBe(true);
    expect(repeated.nextState.status).toBe('completed');
    expect(repeated.nextState.winner).toBeNull();
    expect(repeated.nextState.outcomeReason).toBe('draw_repetition');
  });

  it('does not adjudicate repetition before the third occurrence', () => {
    const state = createEmptyXiangqiState('red');
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 0, 9, 'chariot', 'red');
    putPiece(state, 4, 5, 'soldier', 'red');

    const move = {
      from: { x: 0, y: 9 },
      to: { x: 0, y: 8 },
      player: 'red' as const
    };

    const first = applyXiangqiMove(state, move);
    expect(first.accepted).toBe(true);
    expect(first.nextState.status).toBe('playing');

    const nextHash = first.nextState.positionHistory[first.nextState.positionHistory.length - 1] ?? '';
    const almostRepeatedState = {
      ...state,
      positionHistory: [nextHash]
    };

    const second = applyXiangqiMove(almostRepeatedState, move);
    expect(second.accepted).toBe(true);
    expect(second.nextState.status).toBe('playing');
    expect(second.nextState.outcomeReason).toBeNull();
  });

  it('applies deterministic perpetual-check loss policy', () => {
    const state = createEmptyXiangqiState('red');
    putPiece(state, 4, 9, 'general', 'red');
    putPiece(state, 4, 0, 'general', 'black');
    putPiece(state, 4, 2, 'chariot', 'red');

    const move = {
      from: { x: 4, y: 2 },
      to: { x: 4, y: 1 },
      player: 'red' as const
    };

    const first = applyXiangqiMove(state, move);
    expect(first.accepted).toBe(true);

    const nextHash = first.nextState.positionHistory[first.nextState.positionHistory.length - 1] ?? '';
    const repeatedState = {
      ...state,
      positionHistory: [nextHash, nextHash]
    };

    const repeated = applyXiangqiMove(repeatedState, move);
    expect(repeated.accepted).toBe(true);
    expect(repeated.nextState.status).toBe('completed');
    expect(repeated.nextState.winner).toBe('black');
    expect(repeated.nextState.outcomeReason).toBe('perpetual_check_violation');
  });
});
