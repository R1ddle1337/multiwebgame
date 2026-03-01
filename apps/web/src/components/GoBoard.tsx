import type { GoState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: GoState;
  disabled?: boolean;
  onCellClick?: (x: number, y: number) => void;
}

function boardLines(boardSize: number) {
  const edge = boardSize - 0.5;
  const lines: React.ReactElement[] = [];

  for (let i = 0; i < boardSize; i += 1) {
    const point = i + 0.5;
    lines.push(<line key={`go-h-${i}`} x1="0.5" y1={point} x2={edge} y2={point} />);
    lines.push(<line key={`go-v-${i}`} x1={point} y1="0.5" x2={point} y2={edge} />);
  }

  return lines;
}

export function GoBoard({ state, disabled = false, onCellClick }: Props) {
  return (
    <div className="go-board" aria-label="go-board">
      <svg
        className="go-lines"
        viewBox={`0 0 ${state.boardSize} ${state.boardSize}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {boardLines(state.boardSize)}
      </svg>
      <div
        className="go-grid"
        style={{ gridTemplateColumns: `repeat(${state.boardSize}, minmax(22px, 1fr))` }}
      >
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
    </div>
  );
}
