import {
  apply2048Move,
  applyCardsMove,
  applyConnect4Move,
  applyDotsMove,
  applyHexMove,
  applyGoMove,
  applyGomokuMove,
  applyQuoridorMove,
  applyReversiMove,
  applyXiangqiMove,
  create2048State,
  createCardsDeck,
  createCardsState,
  createConnect4State,
  createDotsState,
  createHexState,
  createGoState,
  createGomokuState,
  createQuoridorState,
  createReversiState,
  createXiangqiState,
  type CardsRuntimeState,
  createDeterministicPrng,
  formatXiangqiMoveNotation
} from '@multiwebgame/game-engines';
import type {
  CardsCard,
  CardsMove,
  Connect4Move,
  Connect4State,
  DotsMove,
  DotsState,
  Direction2048,
  GameType,
  Game2048State,
  GoMove,
  GoState,
  GomokuMark,
  GomokuState,
  HexMove,
  HexState,
  QuoridorMove,
  QuoridorState,
  ReversiMove,
  ReversiState,
  XiangqiColor,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { Connect4Board } from '../components/Connect4Board';
import { DotsBoard } from '../components/DotsBoard';
import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { HexBoard } from '../components/HexBoard';
import { QuoridorBoard } from '../components/QuoridorBoard';
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

function isCardsCard(value: unknown): value is CardsCard {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as { suit?: unknown; rank?: unknown };
  return (
    (typed.suit === 'clubs' ||
      typed.suit === 'diamonds' ||
      typed.suit === 'hearts' ||
      typed.suit === 'spades') &&
    (typed.rank === 'A' ||
      typed.rank === '2' ||
      typed.rank === '3' ||
      typed.rank === '4' ||
      typed.rank === '5' ||
      typed.rank === '6' ||
      typed.rank === '7' ||
      typed.rank === '8' ||
      typed.rank === '9' ||
      typed.rank === '10' ||
      typed.rank === 'J' ||
      typed.rank === 'Q' ||
      typed.rank === 'K')
  );
}

function isCardsMove(value: unknown): value is CardsMove {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<CardsMove>;
  if (typed.type === 'draw' || typed.type === 'end_turn') {
    return typed.player === 'black' || typed.player === 'white';
  }

  if (typed.type === 'play') {
    return (
      (typed.player === 'black' || typed.player === 'white') &&
      isCardsCard(typed.card) &&
      (typed.chosenSuit === undefined ||
        typed.chosenSuit === 'clubs' ||
        typed.chosenSuit === 'diamonds' ||
        typed.chosenSuit === 'hearts' ||
        typed.chosenSuit === 'spades')
    );
  }

  return false;
}

function parseCardsMove(payload: Record<string, unknown>): CardsMove | null {
  const nested = payload.move;
  if (isCardsMove(nested)) {
    return nested;
  }

  return isCardsMove(payload) ? payload : null;
}

function parseQuoridorMove(
  payload: Record<string, unknown>,
  fallbackPlayer: QuoridorMove['player']
): QuoridorMove | null {
  const source = (payload.move ?? payload) as Partial<QuoridorMove>;
  if (source.type === 'pawn') {
    if (typeof source.x !== 'number' || typeof source.y !== 'number') {
      return null;
    }
    if (!Number.isInteger(source.x) || !Number.isInteger(source.y)) {
      return null;
    }

    return {
      type: 'pawn',
      x: source.x,
      y: source.y,
      player: source.player === 'black' || source.player === 'white' ? source.player : fallbackPlayer
    };
  }

  if (source.type === 'wall') {
    if (
      typeof source.x !== 'number' ||
      typeof source.y !== 'number' ||
      !Number.isInteger(source.x) ||
      !Number.isInteger(source.y) ||
      (source.orientation !== 'h' && source.orientation !== 'v')
    ) {
      return null;
    }

    return {
      type: 'wall',
      orientation: source.orientation,
      x: source.x,
      y: source.y,
      player: source.player === 'black' || source.player === 'white' ? source.player : fallbackPlayer
    };
  }

  return null;
}

function formatCardsCard(card: { rank: string; suit: string }): string {
  return `${card.rank}${card.suit.slice(0, 1).toUpperCase()}`;
}

export function ReplayPage({ api, viewerUserId }: Props) {
  const { t, translateError } = useI18n();
  const { matchId = '' } = useParams();
  const [gameType, setGameType] = useState<GameType>('gomoku');
  const [gomokuStates, setGomokuStates] = useState<GomokuState[]>([createGomokuState(15)]);
  const [connect4States, setConnect4States] = useState<Connect4State[]>([createConnect4State()]);
  const [dotsStates, setDotsStates] = useState<DotsState[]>([createDotsState()]);
  const [goStates, setGoStates] = useState<GoState[]>([createGoState(9)]);
  const [hexStates, setHexStates] = useState<HexState[]>([
    createHexState({
      boardSize: 11
    })
  ]);
  const [quoridorStates, setQuoridorStates] = useState<QuoridorState[]>([
    createQuoridorState({
      boardSize: 9,
      wallsPerPlayer: 10
    })
  ]);
  const [reversiStates, setReversiStates] = useState<ReversiState[]>([createReversiState()]);
  const [xiangqiStates, setXiangqiStates] = useState<XiangqiState[]>([createXiangqiState()]);
  const [cardsStates, setCardsStates] = useState<CardsRuntimeState[]>([
    createCardsState({
      deck: createCardsDeck()
    })
  ]);
  const [xiangqiMoveLog, setXiangqiMoveLog] = useState<XiangqiReplayMoveLogEntry[]>([]);
  const [xiangqiPerspective, setXiangqiPerspective] = useState<XiangqiColor>('red');
  const [game2048States, setGame2048States] = useState<Game2048State[]>([create2048State(() => 0)]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameLabel = (type: GameType) => t(`enum.game.${type}`);
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

        if (result.match.gameType === 'hex') {
          let current = createHexState({
            boardSize: 11
          });
          const snapshots: HexState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as Partial<HexMove>;
            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
              continue;
            }

            const applied = applyHexMove(current, {
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

          setHexStates(snapshots);
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'quoridor') {
          let current = createQuoridorState({
            boardSize: 9,
            wallsPerPlayer: 10
          });
          const snapshots: QuoridorState[] = [current];

          for (const move of result.match.moves) {
            const parsedMove = parseQuoridorMove(move.payload as Record<string, unknown>, current.nextPlayer);
            if (!parsedMove) {
              continue;
            }

            const applied = applyQuoridorMove(current, parsedMove);
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setQuoridorStates(snapshots);
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

        if (result.match.gameType === 'dots') {
          let current = createDotsState();
          const snapshots: DotsState[] = [current];

          for (const move of result.match.moves) {
            const payload = move.payload as Partial<DotsMove> & { move?: Partial<DotsMove> };
            const source = payload.move ?? payload;
            if (!source || typeof source.x !== 'number' || typeof source.y !== 'number') {
              continue;
            }

            if (source.orientation !== 'h' && source.orientation !== 'v') {
              continue;
            }

            const applied = applyDotsMove(current, {
              orientation: source.orientation,
              x: source.x,
              y: source.y,
              player: source.player ?? current.nextPlayer
            });
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setDotsStates(snapshots);
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

        if (result.match.gameType === 'cards') {
          const payload = result.match.resultPayload as { rng?: { rngSeed?: unknown } } | null;
          let rngSeed = typeof payload?.rng?.rngSeed === 'string' ? payload.rng.rngSeed : null;

          if (!rngSeed) {
            const fromMove = result.match.moves
              .map((entry) => entry.payload as { rngSeed?: unknown })
              .find((entry) => typeof entry.rngSeed === 'string');
            rngSeed = typeof fromMove?.rngSeed === 'string' ? fromMove.rngSeed : null;
          }

          if (!rngSeed) {
            setError(t('common.error_generic'));
            return;
          }

          const prng = createDeterministicPrng(rngSeed);
          const deck = createCardsDeck();
          prng.shuffleInPlace(deck);

          let current = createCardsState({ deck });
          const snapshots: CardsRuntimeState[] = [current];

          for (const move of result.match.moves) {
            const parsedMove = parseCardsMove(move.payload as Record<string, unknown>);
            if (!parsedMove) {
              continue;
            }

            const applied = applyCardsMove(current, parsedMove);
            if (!applied.accepted) {
              continue;
            }

            current = applied.nextState;
            snapshots.push(current);
          }

          setCardsStates(snapshots);
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(snapshots.length - 1);
          return;
        }

        if (result.match.gameType === 'backgammon') {
          setXiangqiMoveLog([]);
          setXiangqiPerspective('red');
          setStep(0);
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
    if (gameType === 'dots') {
      return Math.max(0, dotsStates.length - 1);
    }
    if (gameType === 'go') {
      return Math.max(0, goStates.length - 1);
    }
    if (gameType === 'hex') {
      return Math.max(0, hexStates.length - 1);
    }
    if (gameType === 'quoridor') {
      return Math.max(0, quoridorStates.length - 1);
    }
    if (gameType === 'reversi') {
      return Math.max(0, reversiStates.length - 1);
    }
    if (gameType === 'xiangqi') {
      return Math.max(0, xiangqiStates.length - 1);
    }
    if (gameType === 'cards') {
      return Math.max(0, cardsStates.length - 1);
    }
    if (gameType === 'single_2048') {
      return Math.max(0, game2048States.length - 1);
    }
    return 0;
  }, [
    gameType,
    goStates.length,
    hexStates.length,
    gomokuStates.length,
    quoridorStates.length,
    connect4States.length,
    dotsStates.length,
    reversiStates.length,
    xiangqiStates.length,
    cardsStates.length,
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
      {gameType === 'dots' ? (
        <>
          <DotsBoard state={dotsStates[clampedStep]} disabled />
          <p>
            {t('room.dots.scores', {
              black: dotsStates[clampedStep].scores.black,
              white: dotsStates[clampedStep].scores.white
            })}
          </p>
        </>
      ) : null}
      {gameType === 'go' ? <GoBoard state={goStates[clampedStep]} disabled /> : null}
      {gameType === 'hex' ? <HexBoard state={hexStates[clampedStep]} disabled /> : null}
      {gameType === 'quoridor' ? (
        <>
          <p>
            {t('room.quoridor.walls_remaining', {
              black: quoridorStates[clampedStep].remainingWalls.black,
              white: quoridorStates[clampedStep].remainingWalls.white
            })}
          </p>
          <QuoridorBoard state={quoridorStates[clampedStep]} disabled />
        </>
      ) : null}
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
      {gameType === 'cards' ? (
        <>
          <p>
            {t('room.cards.top', {
              card: formatCardsCard(
                cardsStates[clampedStep].discardPile[cardsStates[clampedStep].discardPile.length - 1]
              )
            })}
          </p>
          <p>
            {t('room.cards.active_suit', { suit: t(`enum.suit.${cardsStates[clampedStep].activeSuit}`) })}
          </p>
          <p>
            {t('room.cards.hand_counts', {
              black: cardsStates[clampedStep].hands.black.length,
              white: cardsStates[clampedStep].hands.white.length
            })}
          </p>
          <p>{t('room.cards.draw_pile', { count: cardsStates[clampedStep].drawPile.length })}</p>
          <p>{t('room.cards.discard_pile', { count: cardsStates[clampedStep].discardPile.length })}</p>
          <div className="replay-cards-hands">
            <div>
              <strong>{t('enum.color.black')}</strong>
              <div className="replay-cards-row">
                {cardsStates[clampedStep].hands.black.map((card, index) => (
                  <span key={`black-${card.suit}-${card.rank}-${index}`} className="status-pill">
                    {formatCardsCard(card)}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <strong>{t('enum.color.white')}</strong>
              <div className="replay-cards-row">
                {cardsStates[clampedStep].hands.white.map((card, index) => (
                  <span key={`white-${card.suit}-${card.rank}-${index}`} className="status-pill">
                    {formatCardsCard(card)}
                  </span>
                ))}
              </div>
            </div>
          </div>
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
