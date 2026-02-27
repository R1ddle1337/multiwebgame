import type { GoState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: GoState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

export function GoBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div className="go-grid" style={{ gridTemplateColumns: `repeat(${state.boardSize}, minmax(22px, 1fr))` }}>
      {state.board.map((row, y) =>
        row.map((cell, x) => (
          <button
            key={`${x}:${y}`}
            type="button"
            className="go-cell"
            disabled={disabled || !onCellClick}
            onClick={() => onCellClick?.(x, y)}
            aria-label={`go-cell-${x}-${y}`}
          >
            {cell ? <span className={`stone ${cell}`} /> : null}
          </button>
        ))
      )}
    </div>
  );
}
