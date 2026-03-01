import type { QuoridorState, QuoridorWallOrientation } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: QuoridorState;
  disabled?: boolean;
  onPawnMove?: (x: number, y: number) => void;
  onWallPlace?: (orientation: QuoridorWallOrientation, x: number, y: number) => void;
}

function pawnAt(state: QuoridorState, x: number, y: number): 'black' | 'white' | null {
  if (state.pawns.black.x === x && state.pawns.black.y === y) {
    return 'black';
  }

  if (state.pawns.white.x === x && state.pawns.white.y === y) {
    return 'white';
  }

  return null;
}

export function QuoridorBoard({ state, disabled = false, onPawnMove, onWallPlace }: Props) {
  const wallGrid = state.boardSize - 1;

  return (
    <div className="quoridor-layout">
      <div
        className="quoridor-grid"
        style={{
          gridTemplateColumns: `repeat(${state.boardSize}, minmax(0, 1fr))`
        }}
      >
        {Array.from({ length: state.boardSize * state.boardSize }).map((_, index) => {
          const x = index % state.boardSize;
          const y = Math.floor(index / state.boardSize);
          const pawn = pawnAt(state, x, y);

          return (
            <button
              key={`${x}-${y}`}
              type="button"
              className="quoridor-cell"
              disabled={disabled}
              onClick={() => onPawnMove?.(x, y)}
            >
              {pawn ? <span className={`stone ${pawn}`} /> : null}
            </button>
          );
        })}
      </div>

      <div className="quoridor-wall-panels">
        <div>
          <p>Horizontal</p>
          <div
            className="quoridor-wall-grid"
            style={{
              gridTemplateColumns: `repeat(${wallGrid}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: wallGrid * wallGrid }).map((_, index) => {
              const x = index % wallGrid;
              const y = Math.floor(index / wallGrid);
              const occupied = state.walls.horizontal[y][x];

              return (
                <button
                  key={`h-${x}-${y}`}
                  type="button"
                  className={`quoridor-wall-anchor ${occupied ? 'occupied' : ''}`}
                  disabled={disabled || occupied}
                  onClick={() => onWallPlace?.('h', x, y)}
                >
                  {occupied ? '\u2014' : '+'}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p>Vertical</p>
          <div
            className="quoridor-wall-grid"
            style={{
              gridTemplateColumns: `repeat(${wallGrid}, minmax(0, 1fr))`
            }}
          >
            {Array.from({ length: wallGrid * wallGrid }).map((_, index) => {
              const x = index % wallGrid;
              const y = Math.floor(index / wallGrid);
              const occupied = state.walls.vertical[y][x];

              return (
                <button
                  key={`v-${x}-${y}`}
                  type="button"
                  className={`quoridor-wall-anchor ${occupied ? 'occupied' : ''}`}
                  disabled={disabled || occupied}
                  onClick={() => onWallPlace?.('v', x, y)}
                >
                  {occupied ? '|' : '+'}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
