import type { DotsMove, DotsState } from '@multiwebgame/shared-types';
import React from 'react';

interface Props {
  state: DotsState;
  disabled?: boolean;
  onLineClick?: (move: Pick<DotsMove, 'orientation' | 'x' | 'y'>) => void;
}

const CELL = 34;
const PADDING = 14;

function pointX(x: number): number {
  return PADDING + x * CELL;
}

function pointY(y: number): number {
  return PADDING + y * CELL;
}

export function DotsBoard({ state, disabled = false, onLineClick }: Props) {
  const width = PADDING * 2 + (state.dotsX - 1) * CELL;
  const height = PADDING * 2 + (state.dotsY - 1) * CELL;
  const interactive = Boolean(onLineClick) && !disabled;

  return (
    <div className="dots-board" role="application" aria-label="dots-and-boxes-board">
      <svg className="dots-svg" viewBox={`0 0 ${width} ${height}`}>
        {state.boxes.map((row, boxY) =>
          row.map((owner, boxX) => {
            if (!owner) {
              return null;
            }

            return (
              <rect
                key={`box-${boxX}-${boxY}`}
                className={`dots-box ${owner}`}
                x={pointX(boxX) + 4}
                y={pointY(boxY) + 4}
                width={CELL - 8}
                height={CELL - 8}
                rx={6}
              />
            );
          })
        )}

        {state.horizontal.map((row, y) =>
          row.map((drawn, x) =>
            drawn ? (
              <line
                key={`h-${x}-${y}`}
                className="dots-line"
                x1={pointX(x)}
                y1={pointY(y)}
                x2={pointX(x + 1)}
                y2={pointY(y)}
              />
            ) : null
          )
        )}

        {state.vertical.map((row, y) =>
          row.map((drawn, x) =>
            drawn ? (
              <line
                key={`v-${x}-${y}`}
                className="dots-line"
                x1={pointX(x)}
                y1={pointY(y)}
                x2={pointX(x)}
                y2={pointY(y + 1)}
              />
            ) : null
          )
        )}

        {interactive
          ? state.horizontal.map((row, y) =>
              row.map((drawn, x) =>
                drawn ? null : (
                  <line
                    key={`hit-h-${x}-${y}`}
                    className="dots-hitline"
                    x1={pointX(x)}
                    y1={pointY(y)}
                    x2={pointX(x + 1)}
                    y2={pointY(y)}
                    onClick={() => onLineClick?.({ orientation: 'h', x, y })}
                  />
                )
              )
            )
          : null}

        {interactive
          ? state.vertical.map((row, y) =>
              row.map((drawn, x) =>
                drawn ? null : (
                  <line
                    key={`hit-v-${x}-${y}`}
                    className="dots-hitline"
                    x1={pointX(x)}
                    y1={pointY(y)}
                    x2={pointX(x)}
                    y2={pointY(y + 1)}
                    onClick={() => onLineClick?.({ orientation: 'v', x, y })}
                  />
                )
              )
            )
          : null}

        {Array.from({ length: state.dotsY }, (_, y) =>
          Array.from({ length: state.dotsX }, (_, x) => (
            <circle key={`dot-${x}-${y}`} className="dots-dot" cx={pointX(x)} cy={pointY(y)} r={4} />
          ))
        )}
      </svg>
    </div>
  );
}
