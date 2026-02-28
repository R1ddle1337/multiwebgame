import type { Connect4State } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: Connect4State;
  disabled?: boolean;
  onColumnClick?: (column: number) => void;
}

export function Connect4Board({ state, disabled = false, onColumnClick }: Props) {
  return (
    <div
      className="connect4-grid"
      style={{ gridTemplateColumns: `repeat(${state.columns}, minmax(24px, 1fr))` }}
    >
      {state.board.map((row, y) =>
        row.map((cell, x) => (
          <button
            key={`${x}:${y}`}
            type="button"
            className="connect4-cell"
            disabled={disabled || !onColumnClick}
            onClick={() => onColumnClick?.(x)}
            aria-label={`connect4-cell-${x}-${y}`}
          >
            {cell ? <span className={`connect4-disc ${cell}`} /> : null}
          </button>
        ))
      )}
    </div>
  );
}
