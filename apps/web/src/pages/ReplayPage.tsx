import {
  apply2048Move,
  applyConnect4Move,
  applyGoMove,
  applyGomokuMove,
  applyReversiMove,
  applyXiangqiMove,
  create2048State,
  createConnect4State,
  createGoState,
  createGomokuState,
  createReversiState,
  createXiangqiState,
  formatXiangqiMoveNotation
} from '@multiwebgame/game-engines';
import type {
  Connect4Move,
  Connect4State,
  Direction2048,
  Game2048State,
  GoMove,
  GoState,
  GomokuMark,
  GomokuState,
  ReversiMove,
  ReversiState,
  XiangqiColor,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Connect4Board } from '../components/Connect4Board';
import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { ReversiBoard } from '../components/ReversiBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import { XiangqiMoveList, type XiangqiReplayMoveLogEntry } from '../components/XiangqiMoveList';
import { useI18n } from '../context/I18nContext';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
  viewerUserId?: string;
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

interface XiangqiStoredMoveLog {
  from?: XiangqiMove['from'];
  to?: XiangqiMove['to'];
  player?: XiangqiMove['player'];
  notation?: string;
}

interface XiangqiReplayPayload extends Partial<XiangqiMove> {
  notation?: string;
  moveLog?: XiangqiStoredMoveLog;
}

function isXiangqiPosition(value: unknown): value is XiangqiMove['from'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const position = value as Partial<XiangqiMove['from']>;
  return (
    typeof position.x === 'number' &&
    Number.isInteger(position.x) &&
    position.x >= 0 &&
    position.x <= 8 &&
    typeof position.y === 'number' &&
    Number.isInteger(position.y) &&
    position.y >= 0 &&
    position.y <= 9
  );
}

function isXiangqiPlayer(value: unknown): value is XiangqiMove['player'] {
  return value === 'red' || value === 'black';
}

function toXiangqiMove(payload: XiangqiReplayPayload): XiangqiMove | null {
  const source = payload.moveLog ?? payload;
  if (!isXiangqiPosition(source.from) || !isXiangqiPosition(source.to) || !isXiangqiPlayer(source.player)) {
    return null;
  }

  return {
    from: source.from,
    to: source.to,
    player: source.player
  };
}

function notationFromPayload(payload: XiangqiReplayPayload): string | null {
  if (typeof payload.moveLog?.notation === 'string' && payload.moveLog.notation.trim()) {
    return payload.moveLog.notation;
  }

  if (typeof payload.notation === 'string' && payload.notation.trim()) {
    return payload.notation;
  }

  return null;
}

export function ReplayPage({ api, viewerUserId }: Props) {
  const { t, translateError } = useI18n();
  const { matchId = '' } = useParams();
  const [gameType, setGameType] = useState<
    'gomoku' | 'connect4' | 'go' | 'reversi' | 'xiangqi' | 'single_2048'
  >('gomoku');
  const [gomokuStates, setGomokuStates] = useState<GomokuState[]>([createGomokuState(15)]);
  const [connect4States, setConnect4States] = useState<Connect4State[]>([createConnect4State()]);
  const [goStates, setGoStates] = useState<GoState[]>([createGoState(9)]);
  const [reversiStates, setReversiStates] = useState<ReversiState[]>([createReversiState()]);
  const [xiangqiStates, setXiangqiStates] = useState<XiangqiState[]>([createXiangqiState()]);
  const [xiangqiMoveLog, setXiangqiMoveLog] = useState<XiangqiReplayMoveLogEntry[]>([]);
  const [xiangqiPerspective, setXiangqiPerspective] = useState<XiangqiColor>('red');
  const [game2048States, setGame2048States] = useState<Game2048State[]>([create2048State(() => 0)]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameLabel = (type: 'gomoku' | 'connect4' | 'go' | 'reversi' | 'xiangqi' | 'single_2048') =>
    t(`enum.game.${type}`);
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
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
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
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'connect4') {
          let current = createConnect4State();
          const snapshots: Connect4State[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as Partial<Connect4Move>;
            if (typeof payload.column !== 'number') {
              continue;
            }

            const applied = applyConnect4Move(current, {
              column: payload.column,
              player: payload.player ?? current.nextPlayer
            });
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setConnect4States(snapshots);
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'reversi') {
          let current = createReversiState();
          const snapshots: ReversiState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as Partial<ReversiMove>;
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
              continue;
            }

            const applied = applyReversiMove(current, {
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

          setReversiStates(snapshots);
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'xiangqi') {
          let current = createXiangqiState();
          const snapshots: XiangqiState[] = [current];
          const replayMoveLog: XiangqiReplayMoveLogEntry[] = [];

          for (const move of result.match.moves) {
            const payload = move.payload as unknown as XiangqiReplayPayload;
            const replayMove = toXiangqiMove(payload);
            if (!replayMove) {
              continue;
            }

            const applied = applyXiangqiMove(current, replayMove);
            if (!applied.accepted) {
              continue;
            }

            const notation =
              notationFromPayload(payload) ||
              formatXiangqiMoveNotation(current, replayMove) ||
              `${replayMove.from.x},${replayMove.from.y}-${replayMove.to.x},${replayMove.to.y}`;

            current = applied.nextState;
            snapshots.push(current);
            replayMoveLog.push({
              ply: replayMoveLog.length + 1,
              player: replayMove.player,
              move: replayMove,
              notation
            });
          }

          const firstActorUserId = result.match.moves[0]?.actorUserId;
          const viewerParticipated =
            typeof viewerUserId === 'string' &&
            result.match.moves.some((move) => move.actorUserId === viewerUserId);
          const resolvedPerspective: XiangqiColor =
            viewerParticipated && firstActorUserId && firstActorUserId !== viewerUserId ? 'black' : 'red';

          setXiangqiStates(snapshots);
          setXiangqiMoveLog(replayMoveLog);
          setXiangqiPerspective(resolvedPerspective);
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
        setXiangqiMoveLog([]);
        setXiangqiPerspective('red');
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
  }, [api, matchId, t, translateError, viewerUserId]);

  const maxStep = useMemo(() => {
    if (gameType === 'gomoku') {
      return Math.max(0, gomokuStates.length - 1);
    }
    if (gameType === 'connect4') {
      return Math.max(0, connect4States.length - 1);
    }
    if (gameType === 'go') {
      return Math.max(0, goStates.length - 1);
    }
    if (gameType === 'reversi') {
      return Math.max(0, reversiStates.length - 1);
    }
    if (gameType === 'xiangqi') {
      return Math.max(0, xiangqiStates.length - 1);
    }
    return Math.max(0, game2048States.length - 1);
  }, [
    gameType,
    goStates.length,
    gomokuStates.length,
    connect4States.length,
    reversiStates.length,
    xiangqiStates.length,
    game2048States.length
  ]);

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
      {gameType === 'connect4' ? <Connect4Board state={connect4States[clampedStep]} disabled /> : null}
      {gameType === 'go' ? <GoBoard state={goStates[clampedStep]} disabled /> : null}
      {gameType === 'reversi' ? (
        <>
          <ReversiBoard state={reversiStates[clampedStep]} disabled />
          <p>
            {t('room.reversi.counts', {
              black: reversiStates[clampedStep].counts.black,
              white: reversiStates[clampedStep].counts.white
            })}
          </p>
        </>
      ) : null}
      {gameType === 'xiangqi' ? (
        <>
          <XiangqiBoard state={xiangqiStates[clampedStep]} disabled blackCharacterVariant="traditional" />
          <XiangqiMoveList
            entries={xiangqiMoveLog}
            currentPly={clampedStep}
            onSelectPly={(ply) => setStep(ply)}
            perspective={xiangqiPerspective}
            labels={{
              title: t('replay.moves.title'),
              round: t('replay.moves.round'),
              red: t('replay.moves.red'),
              black: t('replay.moves.black'),
              empty: t('replay.moves.empty')
            }}
          />
        </>
      ) : null}
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
