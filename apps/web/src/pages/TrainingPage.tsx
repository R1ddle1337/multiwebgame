import {
  applyGoMove,
  applyGomokuMove,
  applyXiangqiMove,
  createGoState,
  createGomokuState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type { GoMove, GoState, GomokuState, XiangqiMove, XiangqiState } from '@multiwebgame/shared-types';
import React, { useMemo, useState } from 'react';

import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';

type TrainingGame = 'gomoku' | 'go' | 'xiangqi';

function randomFrom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function gomokuBotMove(state: GomokuState): GomokuState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const options: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      if (state.board[y][x] === null) {
        options.push({ x, y });
      }
    }
  }

  const chosen = randomFrom(options);
  if (!chosen) {
    return state;
  }

  const applied = applyGomokuMove(state, {
    x: chosen.x,
    y: chosen.y,
    player: 'white'
  });

  return applied.accepted ? applied.nextState : state;
}

function goBotMove(state: GoState): GoState {
  if (state.status !== 'playing' || state.nextPlayer !== 'white') {
    return state;
  }

  const options: GoMove[] = [];
  for (let y = 0; y < state.boardSize; y += 1) {
    for (let x = 0; x < state.boardSize; x += 1) {
      options.push({ type: 'place', x, y, player: 'white' });
    }
  }
  options.push({ type: 'pass', player: 'white' });

  while (options.length > 0) {
    const choice = randomFrom(options);
    if (!choice) {
      break;
    }

    const nextOptions = options.filter((entry) => entry !== choice);
    options.splice(0, options.length, ...nextOptions);

    const applied = applyGoMove(state, choice);
    if (applied.accepted) {
      return applied.nextState;
    }
  }

  return state;
}

function generateXiangqiBotMoves(state: XiangqiState): XiangqiMove[] {
  const moves: XiangqiMove[] = [];
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const piece = state.board[y][x];
      if (!piece || piece.color !== 'black') {
        continue;
      }

      for (let toY = 0; toY < 10; toY += 1) {
        for (let toX = 0; toX < 9; toX += 1) {
          const candidate: XiangqiMove = {
            from: { x, y },
            to: { x: toX, y: toY },
            player: 'black'
          };

          const applied = applyXiangqiMove(state, candidate);
          if (applied.accepted) {
            moves.push(candidate);
          }
        }
      }
    }
  }

  return moves;
}

function xiangqiBotMove(state: XiangqiState): XiangqiState {
  if (state.status !== 'playing' || state.nextPlayer !== 'black') {
    return state;
  }

  const moves = generateXiangqiBotMoves(state);
  const chosen = randomFrom(moves);
  if (!chosen) {
    return state;
  }

  const applied = applyXiangqiMove(state, chosen);
  return applied.accepted ? applied.nextState : state;
}

export function TrainingPage() {
  const [game, setGame] = useState<TrainingGame>('gomoku');
  const [gomokuState, setGomokuState] = useState<GomokuState>(() => createGomokuState(15));
  const [goState, setGoState] = useState<GoState>(() => createGoState(9));
  const [xiangqiState, setXiangqiState] = useState<XiangqiState>(() => createXiangqiState());
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);

  const info = useMemo(() => {
    if (game === 'gomoku') {
      return `Training (You: black, Bot: white) - ${gomokuState.status}`;
    }

    if (game === 'go') {
      return `Training (You: black, Bot: white) - ${goState.status}`;
    }

    return `Training (You: red, Bot: black) - ${xiangqiState.status}`;
  }, [game, goState.status, gomokuState.status, xiangqiState.status]);

  return (
    <main className="panel training-page">
      <h2>Training Mode</h2>
      <p>{info}</p>

      <div className="button-row">
        <button
          type="button"
          className={game === 'gomoku' ? '' : 'secondary'}
          onClick={() => setGame('gomoku')}
        >
          Gomoku
        </button>
        <button type="button" className={game === 'go' ? '' : 'secondary'} onClick={() => setGame('go')}>
          Go
        </button>
        <button
          type="button"
          className={game === 'xiangqi' ? '' : 'secondary'}
          onClick={() => setGame('xiangqi')}
        >
          Xiangqi
        </button>
      </div>

      {game === 'gomoku' ? (
        <>
          <GomokuBoard
            state={gomokuState}
            disabled={gomokuState.nextPlayer !== 'black' || gomokuState.status !== 'playing'}
            onCellClick={(x, y) => {
              const first = applyGomokuMove(gomokuState, { x, y, player: 'black' });
              if (!first.accepted) {
                return;
              }

              const withBot = gomokuBotMove(first.nextState);
              setGomokuState(withBot);
            }}
          />
          <button type="button" className="secondary" onClick={() => setGomokuState(createGomokuState(15))}>
            Reset Gomoku Training
          </button>
        </>
      ) : null}

      {game === 'go' ? (
        <>
          <GoBoard
            state={goState}
            disabled={goState.nextPlayer !== 'black' || goState.status !== 'playing'}
            onCellClick={(x, y) => {
              const first = applyGoMove(goState, { type: 'place', x, y, player: 'black' });
              if (!first.accepted) {
                return;
              }

              const withBot = goBotMove(first.nextState);
              setGoState(withBot);
            }}
          />
          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                const first = applyGoMove(goState, { type: 'pass', player: 'black' });
                if (!first.accepted) {
                  return;
                }
                setGoState(goBotMove(first.nextState));
              }}
            >
              Pass
            </button>
            <button type="button" className="secondary" onClick={() => setGoState(createGoState(9))}>
              Reset Go Training
            </button>
          </div>
        </>
      ) : null}

      {game === 'xiangqi' ? (
        <>
          <XiangqiBoard
            state={xiangqiState}
            selected={xiangqiSelection}
            disabled={xiangqiState.nextPlayer !== 'red' || xiangqiState.status !== 'playing'}
            onCellClick={(x, y) => {
              const piece = xiangqiState.board[y][x];

              if (!xiangqiSelection) {
                if (!piece || piece.color !== 'red') {
                  return;
                }
                setXiangqiSelection({ x, y });
                return;
              }

              const move: XiangqiMove = {
                from: xiangqiSelection,
                to: { x, y },
                player: 'red'
              };

              const first = applyXiangqiMove(xiangqiState, move);
              setXiangqiSelection(null);

              if (!first.accepted) {
                return;
              }

              setXiangqiState(xiangqiBotMove(first.nextState));
            }}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setXiangqiSelection(null);
              setXiangqiState(createXiangqiState());
            }}
          >
            Reset Xiangqi Training
          </button>
        </>
      ) : null}
    </main>
  );
}
