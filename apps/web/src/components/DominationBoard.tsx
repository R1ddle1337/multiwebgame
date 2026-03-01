import type { DominationState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: DominationState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

export function DominationBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div
      className="domination-grid"
      style={{
        gridTemplateColumns: `repeat(${state.boardSize}, minmax(1.85rem, 1fr))`
      }}
    >
      {state.board.map((row, y) =>
        row.map((cell, x) => (
          <button
            key={`domination-${x}-${y}`}
            type="button"
            className="domination-cell"
            disabled={disabled || cell !== null}
            onClick={() => onCellClick?.(x, y)}
            aria-label={`domination-cell-${x}-${y}`}
          >
            {cell === 'black' ? 'B' : cell === 'white' ? 'W' : '·'}
          </button>
        ))
      )}
    </div>
  );
}
