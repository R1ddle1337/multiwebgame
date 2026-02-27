import type { GomokuState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: GomokuState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

export function GomokuBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div className="gomoku-grid" style={{ gridTemplateColumns: `repeat(${state.boardSize}, minmax(18px, 1fr))` }}>
      {state.board.map((row, y) =>
        row.map((cell, x) => (
          <button
            key={`${x}:${y}`}
            type="button"
            className="gomoku-cell"
            disabled={disabled || !onCellClick}
            onClick={() => onCellClick?.(x, y)}
            aria-label={`cell-${x}-${y}`}
          >
            {cell ? <span className={`stone ${cell}`} /> : null}
          </button>
        ))
      )}
    </div>
  );
}
