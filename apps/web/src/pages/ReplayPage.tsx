import {
  apply2048Move,
  applyGoMove,
  applyGomokuMove,
  applyXiangqiMove,
  create2048State,
  createGoState,
  createGomokuState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type {
  Direction2048,
  Game2048State,
  GoMove,
  GoState,
  GomokuMark,
  GomokuState,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import { useI18n } from '../context/I18nContext';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
}

function randomFromSequence(values: number[]): () => number {
  const queue = [...values];
  return () => {
    const next = queue.shift();
    if (typeof next !== 'number') {
      return 0.5;
    }
    return next;
  };
}

export function ReplayPage({ api }: Props) {
  const { t, translateError } = useI18n();
  const { matchId = '' } = useParams();
  const [gameType, setGameType] = useState<'gomoku' | 'go' | 'xiangqi' | 'single_2048'>('gomoku');
  const [gomokuStates, setGomokuStates] = useState<GomokuState[]>([createGomokuState(15)]);
  const [goStates, setGoStates] = useState<GoState[]>([createGoState(9)]);
  const [xiangqiStates, setXiangqiStates] = useState<XiangqiState[]>([createXiangqiState()]);
  const [game2048States, setGame2048States] = useState<Game2048State[]>([create2048State(() => 0)]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameLabel = (type: 'gomoku' | 'go' | 'xiangqi' | 'single_2048') => t(`enum.game.${type}`);
  const statusLabel = (status: 'playing' | 'completed' | 'draw' | 'won' | 'lost') =>
    t(`enum.status.${status}`);

  useEffect(() => {
    let active = true;

    api
      .getMatch(matchId)
      .then((result) => {
        if (!active) {
          return;
        }

        setGameType(result.match.gameType);

        if (result.match.gameType === 'gomoku') {
          let current = createGomokuState(15);
          const snapshots: GomokuState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as { x?: number; y?: number; player?: GomokuMark };
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
              continue;
            }

            const applied = applyGomokuMove(current, {
              x: payload.x,
              y: payload.y,
              player: payload.player ?? current.nextPlayer
            });
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setGomokuStates(snapshots);
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'go') {
          let current = createGoState(9);
          const snapshots: GoState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as GoMove;
            if (!payload || typeof payload !== 'object' || !('type' in payload)) {
              continue;
            }

            const applied = applyGoMove(current, payload);
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setGoStates(snapshots);
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'xiangqi') {
          let current = createXiangqiState();
          const snapshots: XiangqiState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as unknown as Partial<XiangqiMove>;
            if (!payload?.from || !payload?.to || !payload?.player) {
              continue;
            }

            const applied = applyXiangqiMove(current, payload as XiangqiMove);
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setXiangqiStates(snapshots);
          setStep(snapshots.length - 1);
          return;
        }

        let current = create2048State(() => 0);
        const snapshots: Game2048State[] = [current];

        for (const move of result.match.moves) {
          const payload = move.payload as {
            direction?: Direction2048;
            forcedSpawn?: { row: number; col: number; value: number };
            randomValues?: number[];
            board?: number[][];
            score?: number;
            status?: Game2048State['status'];
          };

          if (payload.board && typeof payload.score === 'number') {
            current = {
              board: payload.board,
              score: payload.score,
              status: payload.status ?? current.status
            };
            snapshots.push(current);
            continue;
          }

          if (!payload.direction) {
            continue;
          }

          const random = randomFromSequence(payload.randomValues ?? []);
          const applied = apply2048Move(current, payload.direction, random, payload.forcedSpawn);
          current = applied.state;
          snapshots.push(current);
        }

        setGame2048States(snapshots);
        setStep(snapshots.length - 1);
      })
      .catch((err) => {
        if (active) {
          setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, matchId, t, translateError]);

  const maxStep = useMemo(() => {
    if (gameType === 'gomoku') {
      return Math.max(0, gomokuStates.length - 1);
    }
    if (gameType === 'go') {
      return Math.max(0, goStates.length - 1);
    }
    if (gameType === 'xiangqi') {
      return Math.max(0, xiangqiStates.length - 1);
    }
    return Math.max(0, game2048States.length - 1);
  }, [gameType, goStates.length, gomokuStates.length, xiangqiStates.length, game2048States.length]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const delay = Math.max(120, Math.round(700 / speed));
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= maxStep) {
          setPlaying(false);
          return maxStep;
        }
        return current + 1;
      });
    }, delay);

    return () => clearInterval(timer);
  }, [maxStep, playing, speed]);

  if (loading) {
    return <main className="panel">{t('replay.loading')}</main>;
  }

  if (error) {
    return <main className="panel error-text">{error}</main>;
  }

  const clampedStep = Math.min(step, maxStep);

  return (
    <main className="panel replay-page">
      <h2>{t('replay.title', { id: matchId.slice(0, 8) })}</h2>
      <p>
        {t('replay.meta', {
          game: gameLabel(gameType),
          step: clampedStep,
          max: maxStep
        })}
      </p>

      <div className="button-row">
        <button type="button" className="secondary" onClick={() => setStep(0)}>
          {t('replay.start')}
        </button>
        <button type="button" className="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
          {t('replay.prev')}
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying((current) => !current);
          }}
        >
          {playing ? t('replay.pause') : t('replay.play')}
        </button>
        <button type="button" className="secondary" onClick={() => setStep((s) => Math.min(maxStep, s + 1))}>
          {t('replay.next')}
        </button>
        <button type="button" className="secondary" onClick={() => setStep(maxStep)}>
          {t('replay.end')}
        </button>

        <label className="speed-picker">
          {t('replay.speed')}
          <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </label>
      </div>

      <input
        type="range"
        min={0}
        max={maxStep}
        value={clampedStep}
        onChange={(event) => setStep(Number(event.target.value))}
      />

      {gameType === 'gomoku' ? <GomokuBoard state={gomokuStates[clampedStep]} disabled /> : null}
      {gameType === 'go' ? <GoBoard state={goStates[clampedStep]} disabled /> : null}
      {gameType === 'xiangqi' ? <XiangqiBoard state={xiangqiStates[clampedStep]} disabled /> : null}
      {gameType === 'single_2048' ? (
        <div className="game-2048 replay-2048">
          <p>
            {t('replay.score', {
              score: game2048States[clampedStep].score,
              status: statusLabel(game2048States[clampedStep].status)
            })}
          </p>
          <div className="tile-grid">
            {game2048States[clampedStep].board.flat().map((cell, index) => (
              <div key={index} className={`tile tile-${cell || 'empty'}`}>
                {cell || ''}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
