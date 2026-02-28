import type { XiangqiPiece, XiangqiState } from '@multiwebgame/shared-types';
import React from 'react';

type XiangqiBlackCharacterVariant = 'simplified' | 'traditional';

interface Props {
  state: XiangqiState;
  disabled?: boolean;
  selected?: { x: number; y: number } | null;
  onCellClick?: (x: number, y: number) => void;
  blackCharacterVariant?: XiangqiBlackCharacterVariant;
}

const RED_LABELS: Record<XiangqiPiece['type'], string> = {
  general: '帅',
  advisor: '仕',
  elephant: '相',
  horse: '马',
  chariot: '车',
  cannon: '炮',
  soldier: '兵'
};

const BLACK_LABELS: Record<XiangqiBlackCharacterVariant, Record<XiangqiPiece['type'], string>> = {
  simplified: {
    general: '将',
    advisor: '士',
    elephant: '象',
    horse: '马',
    chariot: '车',
    cannon: '炮',
    soldier: '卒'
  },
  traditional: {
    general: '将',
    advisor: '士',
    elephant: '象',
    horse: '馬',
    chariot: '車',
    cannon: '砲',
    soldier: '卒'
  }
};

function label(piece: XiangqiPiece, blackCharacterVariant: XiangqiBlackCharacterVariant): string {
  if (piece.color === 'red') {
    return RED_LABELS[piece.type];
  }

  return BLACK_LABELS[blackCharacterVariant][piece.type];
}

function boardLines() {
  const lines: React.ReactElement[] = [];

  for (let y = 0; y < 10; y += 1) {
    lines.push(<line key={`h-${y}`} x1="0.5" y1={y + 0.5} x2="8.5" y2={y + 0.5} />);
  }

  for (let x = 0; x < 9; x += 1) {
    if (x === 0 || x === 8) {
      lines.push(<line key={`v-${x}`} x1={x + 0.5} y1="0.5" x2={x + 0.5} y2="9.5" />);
      continue;
    }

    lines.push(<line key={`v-${x}-top`} x1={x + 0.5} y1="0.5" x2={x + 0.5} y2="4.5" />);
    lines.push(<line key={`v-${x}-bottom`} x1={x + 0.5} y1="5.5" x2={x + 0.5} y2="9.5" />);
  }

  lines.push(<line key="palace-black-a" x1="3.5" y1="0.5" x2="5.5" y2="2.5" />);
  lines.push(<line key="palace-black-b" x1="5.5" y1="0.5" x2="3.5" y2="2.5" />);
  lines.push(<line key="palace-red-a" x1="3.5" y1="7.5" x2="5.5" y2="9.5" />);
  lines.push(<line key="palace-red-b" x1="5.5" y1="7.5" x2="3.5" y2="9.5" />);

  return lines;
}

export function XiangqiBoard({
  state,
  disabled = false,
  selected,
  onCellClick,
  blackCharacterVariant = 'traditional'
}: Props) {
  return (
    <div className="xiangqi-board" aria-label="xiangqi-board">
      <svg className="xiangqi-lines" viewBox="0 0 9 10" preserveAspectRatio="none" aria-hidden="true">
        {boardLines()}
      </svg>
      <div className="xiangqi-river" aria-hidden="true">
        <span>楚河</span>
        <span>汉界</span>
      </div>
      <div className="xiangqi-grid" style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}>
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
                {cell ? (
                  <span className={`xiangqi-piece ${cell.color}`}>{label(cell, blackCharacterVariant)}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
