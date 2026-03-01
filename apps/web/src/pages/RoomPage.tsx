import {
  createConnect4State,
  createDotsState,
  createGoState,
  createGomokuState,
  createQuoridorState,
  createReversiState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type {
  CardsCard,
  CardsMoveInput,
  CardsState,
  Connect4Move,
  Connect4State,
  DotsMove,
  DotsState,
  GoMove,
  GoState,
  GomokuMove,
  GomokuState,
  QuoridorMove,
  QuoridorMoveInput,
  QuoridorState,
  ReversiMove,
  ReversiState,
  RoomDTO,
  UserDTO,
  XiangqiColor,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Connect4Board } from '../components/Connect4Board';
import { DotsBoard } from '../components/DotsBoard';
import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { QuoridorBoard } from '../components/QuoridorBoard';
import { ReversiBoard } from '../components/ReversiBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';
import { describeLastMove, didTurnSwitchToCurrent, type LastMoveSummary } from '../lib/roomUx';

interface Props {
  api: ApiClient;
  user: UserDTO;
}

function playerSeat(room: RoomDTO | null, userId: string): number | null {
  if (!room) {
    return null;
  }

  return room.players.find((player) => player.userId === userId)?.seat ?? null;
}

function formatResultText(
  state: Connect4State | DotsState | GomokuState | GoState | QuoridorState | ReversiState | XiangqiState,
  statusLabel: (status: 'open' | 'in_match' | 'closed' | 'playing' | 'completed' | 'draw') => string,
  colorLabel: (color: 'black' | 'white' | 'red' | 'yellow') => string,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (state.status === 'playing') {
    return statusLabel('playing');
  }

  if (state.status === 'draw') {
    return t('room.result.draw');
  }

  if (state.winner) {
    return t('room.result.winner', { winner: colorLabel(state.winner) });
  }

  return t('room.result.draw');
}

function formatActionText(
  summary: LastMoveSummary,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (summary.action.kind === 'pass') {
    return t('room.last_move.action.pass');
  }

  if (summary.action.kind === 'place') {
    return t('room.last_move.action.place', { point: summary.action.point });
  }

  return t('room.last_move.action.move', {
    from: summary.action.from,
    to: summary.action.to
  });
}

const CARD_SUITS: CardsCard['suit'][] = ['clubs', 'diamonds', 'hearts', 'spades'];

function formatCardsCard(card: CardsCard): string {
  const suitInitial = card.suit.slice(0, 1).toUpperCase();
  return `${card.rank}${suitInitial}`;
}

export function RoomPage({ api, user }: Props) {
  const { t, translateError } = useI18n();
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const realtime = useRealtime();
  const send = realtime.send;

  const [fallbackRoom, setFallbackRoom] = useState<RoomDTO | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteLinkUrl, setInviteLinkUrl] = useState<string | null>(null);
  const [inviteLinkNotice, setInviteLinkNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const gameLabel = (gameType: RoomDTO['gameType']) => t(`enum.game.${gameType}`);
  const roleLabel = (role: 'player' | 'spectator') => t(`enum.role.${role}`);
  const statusLabel = useCallback(
    (status: 'open' | 'in_match' | 'closed' | 'playing' | 'completed' | 'draw') => t(`enum.status.${status}`),
    [t]
  );
  const colorLabel = useCallback(
    (color: 'black' | 'white' | 'red' | 'yellow') => t(`enum.color.${color}`),
    [t]
  );
  const suitLabel = useCallback((suit: CardsCard['suit']) => t(`enum.suit.${suit}`), [t]);

  const watchMode = useMemo(
    () => new URLSearchParams(location.search).get('watch') === '1',
    [location.search]
  );

  const snapshot = realtime.roomStates[roomId];
  const room = snapshot?.room ?? fallbackRoom;

  const gomokuState =
    snapshot?.gameType === 'gomoku' ? (snapshot.state as GomokuState) : createGomokuState(15);
  const connect4State =
    snapshot?.gameType === 'connect4' ? (snapshot.state as Connect4State) : createConnect4State();
  const goState = snapshot?.gameType === 'go' ? (snapshot.state as GoState) : createGoState(9);
  const quoridorState =
    snapshot?.gameType === 'quoridor'
      ? (snapshot.state as QuoridorState)
      : createQuoridorState({
          boardSize: 9,
          wallsPerPlayer: 10
        });
  const reversiState =
    snapshot?.gameType === 'reversi' ? (snapshot.state as ReversiState) : createReversiState();
  const dotsState = snapshot?.gameType === 'dots' ? (snapshot.state as DotsState) : createDotsState();
  const xiangqiState =
    snapshot?.gameType === 'xiangqi' ? (snapshot.state as XiangqiState) : createXiangqiState();
  const cardsState = snapshot?.gameType === 'cards' ? (snapshot.state as CardsState | null) : null;

  const seat = useMemo(() => playerSeat(room, user.id), [room, user.id]);
  const viewerRole =
    snapshot?.viewerRole ?? room?.players.find((player) => player.userId === user.id)?.role ?? 'spectator';
  const activePlayerCount = room?.players.filter((player) => player.role === 'player').length ?? 0;
  const hasActiveMatch = room?.gameType !== 'single_2048' && room?.status === 'in_match';
  const waitingForOpponent = room?.gameType !== 'single_2048' && !hasActiveMatch && activePlayerCount < 2;

  const gomokuTurn =
    hasActiveMatch &&
    room?.gameType === 'gomoku' &&
    viewerRole === 'player' &&
    gomokuState.status === 'playing';
  const connect4Turn =
    hasActiveMatch &&
    room?.gameType === 'connect4' &&
    viewerRole === 'player' &&
    connect4State.status === 'playing';
  const goTurn =
    hasActiveMatch && room?.gameType === 'go' && viewerRole === 'player' && goState.status === 'playing';
  const quoridorTurn =
    hasActiveMatch &&
    room?.gameType === 'quoridor' &&
    viewerRole === 'player' &&
    quoridorState.status === 'playing';
  const reversiTurn =
    hasActiveMatch &&
    room?.gameType === 'reversi' &&
    viewerRole === 'player' &&
    reversiState.status === 'playing';
  const dotsTurn =
    hasActiveMatch && room?.gameType === 'dots' && viewerRole === 'player' && dotsState.status === 'playing';
  const xiangqiTurn =
    hasActiveMatch &&
    room?.gameType === 'xiangqi' &&
    viewerRole === 'player' &&
    xiangqiState.status === 'playing';
  const cardsTurn =
    hasActiveMatch &&
    room?.gameType === 'cards' &&
    viewerRole === 'player' &&
    cardsState?.status === 'playing';

  const canPlayGomoku =
    gomokuTurn &&
    ((seat === 1 && gomokuState.nextPlayer === 'black') ||
      (seat === 2 && gomokuState.nextPlayer === 'white'));
  const canPlayConnect4 =
    connect4Turn &&
    ((seat === 1 && connect4State.nextPlayer === 'red') ||
      (seat === 2 && connect4State.nextPlayer === 'yellow'));
  const canPlayGo =
    goTurn &&
    ((seat === 1 && goState.nextPlayer === 'black') || (seat === 2 && goState.nextPlayer === 'white'));
  const canPlayQuoridor =
    quoridorTurn &&
    ((seat === 1 && quoridorState.nextPlayer === 'black') ||
      (seat === 2 && quoridorState.nextPlayer === 'white'));
  const canPlayReversi =
    reversiTurn &&
    ((seat === 1 && reversiState.nextPlayer === 'black') ||
      (seat === 2 && reversiState.nextPlayer === 'white'));
  const canPlayDots =
    dotsTurn &&
    ((seat === 1 && dotsState.nextPlayer === 'black') || (seat === 2 && dotsState.nextPlayer === 'white'));
  const canPlayXiangqi =
    xiangqiTurn &&
    ((seat === 1 && xiangqiState.nextPlayer === 'red') ||
      (seat === 2 && xiangqiState.nextPlayer === 'black'));
  const canPlayCards =
    Boolean(cardsTurn) &&
    ((seat === 1 && cardsState?.nextPlayer === 'black') ||
      (seat === 2 && cardsState?.nextPlayer === 'white'));
  const canPlayCurrentTurn =
    canPlayGomoku ||
    canPlayConnect4 ||
    canPlayGo ||
    canPlayQuoridor ||
    canPlayReversi ||
    canPlayDots ||
    canPlayXiangqi ||
    canPlayCards;
  const xiangqiPerspective: XiangqiColor = seat === 2 ? 'black' : 'red';
  const previousCanPlayRef = useRef(false);

  const latestMoveSummary = useMemo<LastMoveSummary | null>(() => {
    if (!room || room.gameType === 'single_2048') {
      return null;
    }

    if (!snapshot?.lastMove || snapshot.gameType !== room.gameType) {
      return null;
    }

    if (room.gameType === 'gomoku') {
      return describeLastMove('gomoku', snapshot.lastMove as GomokuMove);
    }

    if (room.gameType === 'connect4') {
      return describeLastMove('connect4', snapshot.lastMove as Connect4Move);
    }

    if (room.gameType === 'go') {
      return describeLastMove('go', snapshot.lastMove as GoMove);
    }

    if (room.gameType === 'reversi') {
      return describeLastMove('reversi', snapshot.lastMove as ReversiMove);
    }

    if (room.gameType === 'dots') {
      return describeLastMove('dots', snapshot.lastMove as DotsMove);
    }

    if (room.gameType === 'quoridor') {
      return describeLastMove('quoridor', snapshot.lastMove as QuoridorMove);
    }

    if (room.gameType === 'cards') {
      return null;
    }

    return describeLastMove('xiangqi', snapshot.lastMove as XiangqiMove, xiangqiPerspective);
  }, [room, snapshot, xiangqiPerspective]);

  const latestMoveResult = useMemo(() => {
    if (!room || room.gameType === 'single_2048' || !latestMoveSummary) {
      return null;
    }

    if (room.gameType === 'gomoku') {
      return formatResultText(gomokuState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'connect4') {
      return formatResultText(connect4State, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'go') {
      return formatResultText(goState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'reversi') {
      return formatResultText(reversiState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'dots') {
      return formatResultText(dotsState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'quoridor') {
      return formatResultText(quoridorState, statusLabel, colorLabel, t);
    }

    if (room.gameType === 'cards') {
      return null;
    }

    return formatResultText(xiangqiState, statusLabel, colorLabel, t);
  }, [
    room,
    latestMoveSummary,
    gomokuState,
    connect4State,
    goState,
    quoridorState,
    reversiState,
    dotsState,
    xiangqiState,
    statusLabel,
    colorLabel,
    t
  ]);

  useEffect(() => {
    const justBecameCurrentTurn = didTurnSwitchToCurrent(previousCanPlayRef.current, canPlayCurrentTurn);
    previousCanPlayRef.current = canPlayCurrentTurn;

    if (!justBecameCurrentTurn) {
      return;
    }

    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      return;
    }

    if (document.visibilityState !== 'hidden' || Notification.permission !== 'granted') {
      return;
    }

    const notice = new Notification(t('room.turn_alert.notification_title'), {
      body: t('room.turn_alert.notification_body')
    });
    const timer = window.setTimeout(() => {
      notice.close();
    }, 4_000);

    return () => {
      window.clearTimeout(timer);
      notice.close();
    };
  }, [canPlayCurrentTurn, t]);

  useEffect(() => {
    if (!roomId) {
      return;
    }
    let active = true;
    setError(null);
    setFallbackRoom(null);

    send({
      type: 'room.subscribe',
      payload: { roomId, asSpectator: watchMode }
    });

    api
      .getRoom(roomId)
      .then((result) => {
        if (!active) {
          return;
        }
        setFallbackRoom(result.room);
        if (watchMode) {
          api.joinRoom(roomId, true).catch(() => {
            // Spectator persistence is best effort.
          });
        }
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
      });

    return () => {
      active = false;
      send({
        type: 'room.unsubscribe',
        payload: { roomId }
      });
    };
  }, [api, loadAttempt, roomId, send, t, translateError, watchMode]);

  useEffect(() => {
    if (!realtime.lastError) {
      return;
    }

    const normalizedError = realtime.lastError.trim().toLowerCase();
    if (normalizedError.includes('no_active_match') && !hasActiveMatch) {
      realtime.clearLastError();
      return;
    }

    setError(translateError(realtime.lastError));
    realtime.clearLastError();
  }, [hasActiveMatch, realtime, translateError]);

  const sendGomokuMove = (x: number, y: number) => {
    if (!canPlayGomoku) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'gomoku',
        x,
        y
      }
    });
  };

  const sendConnect4Move = (column: number) => {
    if (!canPlayConnect4) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'connect4',
        column
      }
    });
  };

  const sendGoMove = (move: GoMove) => {
    if (!canPlayGo) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'go',
        move
      }
    });
  };

  const sendQuoridorMove = (move: QuoridorMoveInput) => {
    if (!canPlayQuoridor) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'quoridor',
        move
      }
    });
  };

  const sendReversiMove = (x: number, y: number) => {
    if (!canPlayReversi) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'reversi',
        x,
        y
      }
    });
  };

  const sendDotsMove = (move: Pick<DotsMove, 'orientation' | 'x' | 'y'>) => {
    if (!canPlayDots) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'dots',
        move
      }
    });
  };

  const sendXiangqiMove = (move: XiangqiMove) => {
    if (!canPlayXiangqi) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'xiangqi',
        move
      }
    });
  };

  const sendCardsMove = (move: CardsMoveInput) => {
    if (!canPlayCards) {
      return;
    }

    send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'cards',
        move
      }
    });
  };

  const leaveCurrentRoom = async () => {
    try {
      send({
        type: 'room.unsubscribe',
        payload: { roomId }
      });
      await api.leaveRoom(roomId);
      navigate('/');
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
    }
  };

  if (!room) {
    return (
      <main className="panel">
        <p className={error ? 'error-text' : undefined}>{error ?? t('room.loading')}</p>
        {error ? (
          <div className="button-row">
            <button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>
              {t('common.retry')}
            </button>
            <button type="button" className="secondary" onClick={() => navigate('/')}>
              {t('shell.nav.lobby')}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="content-grid room-layout">
      <section className="panel">
        <h2>{t('room.title', { id: room.id.slice(0, 8) })}</h2>
        <p>
          {t('room.meta', {
            game: gameLabel(room.gameType),
            status: statusLabel(room.status),
            role: roleLabel(viewerRole)
          })}
        </p>

        <div className="button-row">
          <button type="button" className="secondary" onClick={leaveCurrentRoom}>
            {t('room.leave')}
          </button>
          {viewerRole !== 'spectator' ? null : (
            <button
              type="button"
              onClick={async () => {
                await api.joinRoom(room.id, false);
                send({ type: 'room.subscribe', payload: { roomId: room.id } });
              }}
            >
              {t('room.try_join_player')}
            </button>
          )}
        </div>

        <h3>
          {t('room.participants', {
            count: room.players.length,
            max: room.maxPlayers
          })}
        </h3>
        <ul className="simple-list">
          {room.players.map((player) => (
            <li key={player.id}>
              {roleLabel(player.role).toUpperCase()} {player.seat ? `Seat ${player.seat}` : ''}:{' '}
              {player.user.displayName} {player.userId === user.id ? '(You)' : ''}
              {player.userId === user.id ? null : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    api
                      .reportUser({
                        targetUserId: player.userId,
                        reason: 'in-room report'
                      })
                      .then(() => setError(t('lobby.report_submitted')))
                      .catch((err) =>
                        setError(
                          translateError(err instanceof Error ? err.message : t('common.error_generic'))
                        )
                      );
                  }}
                >
                  {t('common.report')}
                </button>
              )}
            </li>
          ))}
        </ul>

        <h3>{t('room.invite.title')}</h3>
        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api.createInvitation(room.id, inviteUserId.trim());
              setInviteUserId('');
              setError(null);
            } catch (err) {
              setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
            }
          }}
        >
          <input
            value={inviteUserId}
            onChange={(event) => setInviteUserId(event.target.value)}
            placeholder={t('room.invite.placeholder')}
          />
          <button type="submit">{t('room.invite.submit')}</button>
        </form>

        <h3>{t('room.invite_link.title')}</h3>
        <p>{t('room.invite_link.hint')}</p>
        <div className="button-row">
          <button
            type="button"
            onClick={async () => {
              try {
                const result = await api.createInviteLink(room.id);
                setInviteLinkUrl(result.url);
                setInviteLinkNotice(null);
                setError(null);
              } catch (err) {
                setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
              }
            }}
          >
            {t('room.invite_link.generate')}
          </button>
          {inviteLinkUrl ? (
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                try {
                  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                    setInviteLinkNotice(t('room.invite_link.copy_manual'));
                    return;
                  }
                  await navigator.clipboard.writeText(inviteLinkUrl);
                  setInviteLinkNotice(t('room.invite_link.copied'));
                } catch {
                  setInviteLinkNotice(t('room.invite_link.copy_manual'));
                }
              }}
            >
              {t('room.invite_link.copy')}
            </button>
          ) : null}
        </div>
        {inviteLinkUrl ? (
          <p>
            <code>{inviteLinkUrl}</code>
          </p>
        ) : null}
        {inviteLinkNotice ? <p>{inviteLinkNotice}</p> : null}

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>{t('room.game.title')}</h2>

        {waitingForOpponent ? (
          <p role="status" aria-live="polite">
            {t('room.waiting_for_opponent')}
          </p>
        ) : null}

        {room.gameType !== 'single_2048' && viewerRole === 'player' && hasActiveMatch ? (
          <div
            className={`room-turn-reminder ${canPlayCurrentTurn ? 'active' : ''}`}
            role="status"
            aria-live="polite"
          >
            <strong>
              {canPlayCurrentTurn ? t('room.turn_alert.your_turn') : t('room.turn_alert.waiting')}
            </strong>
            <span>
              {canPlayCurrentTurn ? t('room.turn_alert.your_turn_hint') : t('room.turn_alert.waiting_hint')}
            </span>
          </div>
        ) : null}

        {room.gameType !== 'single_2048' ? (
          <section className="room-last-move" aria-live="polite">
            <h3>{t('room.last_move.title')}</h3>
            {latestMoveSummary ? (
              <>
                <div className="room-last-move-grid">
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.player')}</span>
                    <strong className="room-last-move-value">{colorLabel(latestMoveSummary.actor)}</strong>
                  </p>
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.action')}</span>
                    <strong className="room-last-move-value">{formatActionText(latestMoveSummary, t)}</strong>
                  </p>
                  <p className="room-last-move-item">
                    <span className="room-last-move-label">{t('room.last_move.result')}</span>
                    <strong className="room-last-move-value">
                      {latestMoveResult ?? t('room.last_move.empty')}
                    </strong>
                  </p>
                </div>
                {room.gameType === 'xiangqi' && xiangqiPerspective === 'black' ? (
                  <p className="room-last-move-note">{t('room.last_move.black_perspective')}</p>
                ) : null}
              </>
            ) : (
              <p className="room-last-move-empty">{t('room.last_move.empty')}</p>
            )}
          </section>
        ) : null}

        {room.gameType === 'single_2048' ? (
          <p>
            {t('room.single_2048')}{' '}
            <button type="button" onClick={() => navigate('/game/2048')}>
              {t('room.open_2048')}
            </button>
            .
          </p>
        ) : null}

        {room.gameType === 'gomoku' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(gomokuState.nextPlayer),
                  status: statusLabel(gomokuState.status)
                })}
              </p>
            ) : null}
            <GomokuBoard state={gomokuState} disabled={!canPlayGomoku} onCellClick={sendGomokuMove} />
            {gomokuState.status === 'completed' || gomokuState.status === 'draw' ? (
              <p>
                {gomokuState.winner
                  ? t('room.result.winner', { winner: colorLabel(gomokuState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'connect4' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(connect4State.nextPlayer),
                  status: statusLabel(connect4State.status)
                })}
              </p>
            ) : null}
            <Connect4Board
              state={connect4State}
              disabled={!canPlayConnect4}
              onColumnClick={sendConnect4Move}
            />
            {connect4State.status === 'completed' || connect4State.status === 'draw' ? (
              <p>
                {connect4State.winner
                  ? t('room.result.winner', { winner: colorLabel(connect4State.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'go' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(goState.nextPlayer),
                  status: statusLabel(goState.status)
                })}
              </p>
            ) : null}
            <GoBoard
              state={goState}
              disabled={!canPlayGo}
              onCellClick={(x, y) => sendGoMove({ type: 'place', x, y, player: 'black' })}
            />
            <div className="button-row">
              <button
                type="button"
                onClick={() => sendGoMove({ type: 'pass', player: 'black' })}
                disabled={!canPlayGo}
              >
                {t('room.pass')}
              </button>
            </div>
            {goState.scoring ? (
              <p>
                {t('room.go.scoring', {
                  black: goState.scoring.black.total,
                  white: goState.scoring.white.total,
                  komi: goState.scoring.komi,
                  winner: goState.scoring.winner ? colorLabel(goState.scoring.winner) : t('room.result.draw')
                })}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'quoridor' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(quoridorState.nextPlayer),
                  status: statusLabel(quoridorState.status)
                })}
              </p>
            ) : null}
            <p>
              {t('room.quoridor.walls_remaining', {
                black: quoridorState.remainingWalls.black,
                white: quoridorState.remainingWalls.white
              })}
            </p>
            <QuoridorBoard
              state={quoridorState}
              disabled={!canPlayQuoridor}
              onPawnMove={(x, y) =>
                sendQuoridorMove({
                  type: 'pawn',
                  x,
                  y
                })
              }
              onWallPlace={(orientation, x, y) =>
                sendQuoridorMove({
                  type: 'wall',
                  orientation,
                  x,
                  y
                })
              }
            />
            {quoridorState.status === 'completed' ? (
              <p>
                {quoridorState.winner
                  ? t('room.result.winner', { winner: colorLabel(quoridorState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'reversi' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(reversiState.nextPlayer),
                  status: statusLabel(reversiState.status)
                })}
              </p>
            ) : null}
            <ReversiBoard
              state={reversiState}
              disabled={!canPlayReversi}
              onCellClick={(x, y) => sendReversiMove(x, y)}
            />
            <p>
              {t('room.reversi.counts', {
                black: reversiState.counts.black,
                white: reversiState.counts.white
              })}
            </p>
            {reversiState.status === 'completed' || reversiState.status === 'draw' ? (
              <p>
                {reversiState.winner
                  ? t('room.result.winner', { winner: colorLabel(reversiState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'dots' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(dotsState.nextPlayer),
                  status: statusLabel(dotsState.status)
                })}
              </p>
            ) : null}
            <DotsBoard state={dotsState} disabled={!canPlayDots} onLineClick={(move) => sendDotsMove(move)} />
            <p>
              {t('room.dots.scores', {
                black: dotsState.scores.black,
                white: dotsState.scores.white
              })}
            </p>
            {dotsState.status === 'completed' || dotsState.status === 'draw' ? (
              <p>
                {dotsState.winner
                  ? t('room.result.winner', { winner: colorLabel(dotsState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}

        {room.gameType === 'cards' ? (
          <>
            {!cardsState ? (
              <p>{t('room.cards.waiting_rng')}</p>
            ) : (
              <>
                {hasActiveMatch ? (
                  <p>
                    {t('room.next_turn', {
                      player: colorLabel(cardsState.nextPlayer),
                      status: statusLabel(cardsState.status)
                    })}
                  </p>
                ) : null}
                <p>{t('room.cards.top', { card: formatCardsCard(cardsState.topCard) })}</p>
                <p>{t('room.cards.active_suit', { suit: suitLabel(cardsState.activeSuit) })}</p>
                <p>
                  {t('room.cards.hand_counts', {
                    black: cardsState.handCounts.black,
                    white: cardsState.handCounts.white
                  })}
                </p>
                {typeof cardsState.drawPileCount === 'number' ? (
                  <p>{t('room.cards.draw_pile', { count: cardsState.drawPileCount })}</p>
                ) : null}
                <p>{t('room.cards.discard_pile', { count: cardsState.discardPileCount })}</p>

                {cardsState.hand ? (
                  <>
                    <p>{t('room.cards.your_hand')}</p>
                    <div className="button-row">
                      {cardsState.hand.map((card, index) => {
                        const playable =
                          card.rank === '8' ||
                          card.suit === cardsState.activeSuit ||
                          card.rank === cardsState.topCard.rank;
                        return (
                          <button
                            key={`${card.suit}-${card.rank}-${index}`}
                            type="button"
                            className="secondary"
                            disabled={!canPlayCards || !playable}
                            onClick={() => {
                              if (card.rank === '8') {
                                const picked = window.prompt(
                                  'suit: clubs | diamonds | hearts | spades',
                                  cardsState.activeSuit
                                );
                                if (!picked) {
                                  return;
                                }
                                const normalized = picked.trim().toLowerCase() as CardsCard['suit'];
                                if (!CARD_SUITS.includes(normalized)) {
                                  setError(t('error.invalid_move'));
                                  return;
                                }
                                sendCardsMove({
                                  type: 'play',
                                  card,
                                  chosenSuit: normalized
                                });
                                return;
                              }

                              sendCardsMove({
                                type: 'play',
                                card
                              });
                            }}
                          >
                            {formatCardsCard(card)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p>{t('room.cards.hidden_hand')}</p>
                )}

                <div className="button-row">
                  <button
                    type="button"
                    onClick={() => sendCardsMove({ type: 'draw' })}
                    disabled={!canPlayCards}
                  >
                    {t('room.cards.draw')}
                  </button>
                  {cardsState.pendingDrawPlay ? (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => sendCardsMove({ type: 'end_turn' })}
                      disabled={!canPlayCards}
                    >
                      {t('room.cards.end_turn')}
                    </button>
                  ) : null}
                </div>
                {cardsState.pendingDrawPlay && canPlayCards ? (
                  <p>{t('room.cards.pending_draw_play')}</p>
                ) : null}
                {cardsState.status === 'completed' ? (
                  <p>
                    {cardsState.winner
                      ? t('room.result.winner', { winner: colorLabel(cardsState.winner) })
                      : t('room.result.draw')}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {room.gameType === 'xiangqi' ? (
          <>
            {hasActiveMatch ? (
              <p>
                {t('room.next_turn', {
                  player: colorLabel(xiangqiState.nextPlayer),
                  status: statusLabel(xiangqiState.status)
                })}
              </p>
            ) : null}
            <XiangqiBoard
              state={xiangqiState}
              selected={xiangqiSelection}
              disabled={!canPlayXiangqi}
              onCellClick={(x, y) => {
                const piece = xiangqiState.board[y][x];

                if (!xiangqiSelection) {
                  if (!piece) {
                    return;
                  }

                  const mine =
                    (seat === 1 && piece.color === 'red') || (seat === 2 && piece.color === 'black');
                  if (!mine) {
                    return;
                  }

                  setXiangqiSelection({ x, y });
                  return;
                }

                sendXiangqiMove({
                  from: xiangqiSelection,
                  to: { x, y },
                  player: seat === 1 ? 'red' : 'black'
                });
                setXiangqiSelection(null);
              }}
            />
            {xiangqiState.status === 'completed' ? (
              <p>
                {xiangqiState.winner
                  ? t('room.result.winner', { winner: colorLabel(xiangqiState.winner) })
                  : t('room.result.draw')}
              </p>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
