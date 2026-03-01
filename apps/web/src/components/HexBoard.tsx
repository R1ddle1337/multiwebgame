import type { HexState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: HexState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

export function HexBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div className="hex-board" role="application" aria-label="hex-board">
      {state.board.map((row, y) => (
        <div
          key={`hex-row-${y}`}
          className="hex-row"
          style={{
            marginInlineStart: `${y * 0.9}rem`
          }}
        >
          {row.map((cell, x) => (
            <button
              key={`${x}-${y}`}
              type="button"
              className="hex-cell"
              disabled={disabled}
              onClick={() => onCellClick?.(x, y)}
              aria-label={`hex-cell-${x}-${y}`}
            >
              {cell ? <span className={`stone ${cell}`} /> : null}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
