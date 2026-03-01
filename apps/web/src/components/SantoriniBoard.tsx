import type { SantoriniState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: SantoriniState;
  disabled?: boolean;
  selected?: { x: number; y: number } | null;
  moveTarget?: { x: number; y: number } | null;
  onCellClick?: (x: number, y: number) => void;
}

function workerAt(state: SantoriniState, x: number, y: number): string | null {
  for (const player of ['black', 'white'] as const) {
    for (const worker of ['a', 'b'] as const) {
      const position = state.workers[player][worker];
      if (position?.x === x && position.y === y) {
        return `${player === 'black' ? 'B' : 'W'}${worker.toUpperCase()}`;
      }
    }
  }

  return null;
}

export function SantoriniBoard({
  state,
  disabled = false,
  selected = null,
  moveTarget = null,
  onCellClick
}: Props) {
  return (
    <div
      className="santorini-grid"
      style={{
        gridTemplateColumns: `repeat(${state.boardSize}, minmax(2.4rem, 1fr))`
      }}
    >
      {state.levels.map((row, y) =>
        row.map((level, x) => {
          const worker = workerAt(state, x, y);
          const isSelected = selected?.x === x && selected.y === y;
          const isMoveTarget = moveTarget?.x === x && moveTarget.y === y;

          return (
            <button
              key={`santorini-${x}-${y}`}
              type="button"
              className={`santorini-cell ${isSelected ? 'selected' : ''} ${isMoveTarget ? 'target' : ''}`.trim()}
              disabled={disabled}
              onClick={() => onCellClick?.(x, y)}
              aria-label={`santorini-cell-${x}-${y}`}
            >
              <span className="santorini-level">L{level}</span>
              <span className="santorini-worker">{worker ?? '·'}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
