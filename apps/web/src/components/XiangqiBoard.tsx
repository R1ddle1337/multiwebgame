import type { XiangqiPiece, XiangqiState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: XiangqiState;
  disabled?: boolean;
  selected?: { x: number; y: number } | null;
  onCellClick?: (x: number, y: number) => void;
}

function label(piece: XiangqiPiece): string {
  const color = piece.color === 'red' ? 'R' : 'B';
  const type =
    piece.type === 'general'
      ? 'G'
      : piece.type === 'advisor'
        ? 'A'
        : piece.type === 'elephant'
          ? 'E'
          : piece.type === 'horse'
            ? 'H'
            : piece.type === 'chariot'
              ? 'R'
              : piece.type === 'cannon'
                ? 'C'
                : 'S';

  return `${color}${type}`;
}

export function XiangqiBoard({ state, disabled = false, selected, onCellClick }: Props) {
  return (
    <div className="xiangqi-grid" style={{ gridTemplateColumns: 'repeat(9, minmax(24px, 1fr))' }}>
      {state.board.map((row, y) =>
        row.map((cell, x) => {
          const isSelected = selected?.x === x && selected?.y === y;
          return (
            <button
              key={`${x}:${y}`}
              type="button"
              className={`xiangqi-cell ${isSelected ? 'selected' : ''}`}
              disabled={disabled || !onCellClick}
              onClick={() => onCellClick?.(x, y)}
              aria-label={`xiangqi-cell-${x}-${y}`}
            >
              {cell ? <span className={`piece ${cell.color}`}>{label(cell)}</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
