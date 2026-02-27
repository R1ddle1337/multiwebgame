import {
  applyGoMove,
  applyGomokuMove,
  applyXiangqiMove,
  createGoState,
  createGomokuState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type {
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
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
}

export function ReplayPage({ api }: Props) {
  const { matchId = '' } = useParams();
  const [gameType, setGameType] = useState<'gomoku' | 'go' | 'xiangqi' | 'single_2048'>('gomoku');
  const [gomokuStates, setGomokuStates] = useState<GomokuState[]>([createGomokuState(15)]);
  const [goStates, setGoStates] = useState<GoState[]>([createGoState(9)]);
  const [xiangqiStates, setXiangqiStates] = useState<XiangqiState[]>([createXiangqiState()]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            current = applied.nextState;
            snapshots.push(current);
          }

          setXiangqiStates(snapshots);
          setStep(snapshots.length - 1);
          return;
        }

        setStep(0);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load replay');
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
  }, [api, matchId]);

  useEffect(() => {
    if (!playing) {
      return;
    }

    const timer = window.setInterval(() => {
      setStep((current) => {
        const max =
          gameType === 'gomoku'
            ? gomokuStates.length - 1
            : gameType === 'go'
              ? goStates.length - 1
              : gameType === 'xiangqi'
                ? xiangqiStates.length - 1
                : 0;

        if (current >= max) {
          setPlaying(false);
          return max;
        }

        return current + 1;
      });
    }, 400);

    return () => clearInterval(timer);
  }, [gameType, goStates.length, gomokuStates.length, playing, xiangqiStates.length]);

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
    return 0;
  }, [gameType, goStates.length, gomokuStates.length, xiangqiStates.length]);

  if (loading) {
    return <main className="panel">Loading replay...</main>;
  }

  if (error) {
    return <main className="panel error-text">{error}</main>;
  }

  return (
    <main className="panel replay-page">
      <h2>Replay {matchId.slice(0, 8)}</h2>
      <p>
        Game: <strong>{gameType}</strong> • Step {step}/{maxStep}
      </p>

      <div className="button-row">
        <button type="button" className="secondary" onClick={() => setStep(0)}>
          Start
        </button>
        <button
          type="button"
          onClick={() => {
            setPlaying((current) => !current);
          }}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" className="secondary" onClick={() => setStep(maxStep)}>
          End
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={maxStep}
        value={step}
        onChange={(event) => setStep(Number(event.target.value))}
      />

      {gameType === 'gomoku' ? <GomokuBoard state={gomokuStates[Math.min(step, maxStep)]} disabled /> : null}
      {gameType === 'go' ? <GoBoard state={goStates[Math.min(step, maxStep)]} disabled /> : null}
      {gameType === 'xiangqi' ? (
        <XiangqiBoard state={xiangqiStates[Math.min(step, maxStep)]} disabled />
      ) : null}
      {gameType === 'single_2048' ? <p>Replay is currently available for board PvP modes.</p> : null}
    </main>
  );
}
