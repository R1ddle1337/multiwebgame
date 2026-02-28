import { describe, expect, it } from 'vitest';

import { applyXiangqiMove, createXiangqiState, formatXiangqiMoveNotation } from '../src/index.js';

describe('formatXiangqiMoveNotation', () => {
  it('formats red horizontal cannon move with chinese numerals', () => {
    const state = createXiangqiState();

    const notation = formatXiangqiMoveNotation(state, {
      from: { x: 7, y: 7 },
      to: { x: 4, y: 7 },
      player: 'red'
    });

    expect(notation).toBe('炮二平五');
  });

  it('formats black horse move with fullwidth arabic numerals by default', () => {
    const initial = createXiangqiState();
    const first = applyXiangqiMove(initial, {
      from: { x: 7, y: 7 },
      to: { x: 4, y: 7 },
      player: 'red'
    });
    expect(first.accepted).toBe(true);

    const notation = formatXiangqiMoveNotation(first.nextState, {
      from: { x: 7, y: 0 },
      to: { x: 6, y: 2 },
      player: 'black'
    });

    expect(notation).toBe('马８进７');
  });

  it('supports black hanzi numerals and traditional piece characters', () => {
    const state = createXiangqiState();

    const notation = formatXiangqiMoveNotation(
      state,
      {
        from: { x: 7, y: 0 },
        to: { x: 6, y: 2 },
        player: 'black'
      },
      {
        blackNumeralStyle: 'hanzi',
        blackCharacterVariant: 'traditional'
      }
    );

    expect(notation).toBe('馬八进七');
  });
});
