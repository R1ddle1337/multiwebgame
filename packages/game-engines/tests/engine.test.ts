import { describe, expect, it } from 'vitest';

import { apply2048Move, applyGomokuMove, create2048State, createGomokuState } from '../src/index.js';

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
