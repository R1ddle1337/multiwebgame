import type { ReversiState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: ReversiState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

export function ReversiBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div
      className="reversi-grid"
      style={{ gridTemplateColumns: `repeat(${state.boardSize}, minmax(24px, 1fr))` }}
    >
      {state.board.map((row, y) =>
        row.map((cell, x) => (
          <button
            key={`${x}:${y}`}
            type="button"
            className="reversi-cell"
            disabled={disabled || !onCellClick}
            onClick={() => onCellClick?.(x, y)}
            aria-label={`reversi-cell-${x}-${y}`}
          >
            {cell ? <span className={`stone ${cell}`} /> : null}
          </button>
        ))
      )}
    </div>
  );
}
