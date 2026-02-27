import { createGoState, createGomokuState, createXiangqiState } from '@multiwebgame/game-engines';
import type {
  GoMove,
  GoState,
  GomokuState,
  RoomDTO,
  UserDTO,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { GoBoard } from '../components/GoBoard';
import { GomokuBoard } from '../components/GomokuBoard';
import { XiangqiBoard } from '../components/XiangqiBoard';
import { useI18n } from '../context/I18nContext';
import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';

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

export function RoomPage({ api, user }: Props) {
  const { t, translateError } = useI18n();
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const realtime = useRealtime();
  const send = realtime.send;

  const [fallbackRoom, setFallbackRoom] = useState<RoomDTO | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);

  const gameLabel = (gameType: RoomDTO['gameType']) => t(`enum.game.${gameType}`);
  const roleLabel = (role: 'player' | 'spectator') => t(`enum.role.${role}`);
  const statusLabel = (status: 'open' | 'in_match' | 'closed' | 'playing' | 'completed' | 'draw') =>
    t(`enum.status.${status}`);
  const colorLabel = (color: 'black' | 'white' | 'red') => t(`enum.color.${color}`);

  const watchMode = useMemo(
    () => new URLSearchParams(location.search).get('watch') === '1',
    [location.search]
  );

  const snapshot = realtime.roomStates[roomId];
  const room = snapshot?.room ?? fallbackRoom;

  const gomokuState =
    snapshot?.gameType === 'gomoku' ? (snapshot.state as GomokuState) : createGomokuState(15);
  const goState = snapshot?.gameType === 'go' ? (snapshot.state as GoState) : createGoState(9);
  const xiangqiState =
    snapshot?.gameType === 'xiangqi' ? (snapshot.state as XiangqiState) : createXiangqiState();

  const seat = useMemo(() => playerSeat(room, user.id), [room, user.id]);
  const viewerRole =
    snapshot?.viewerRole ?? room?.players.find((player) => player.userId === user.id)?.role ?? 'spectator';

  const gomokuTurn =
    room?.gameType === 'gomoku' && viewerRole === 'player' && gomokuState.status === 'playing';
  const goTurn = room?.gameType === 'go' && viewerRole === 'player' && goState.status === 'playing';
  const xiangqiTurn =
    room?.gameType === 'xiangqi' && viewerRole === 'player' && xiangqiState.status === 'playing';

  const canPlayGomoku =
    gomokuTurn &&
    ((seat === 1 && gomokuState.nextPlayer === 'black') ||
      (seat === 2 && gomokuState.nextPlayer === 'white'));
  const canPlayGo =
    goTurn &&
    ((seat === 1 && goState.nextPlayer === 'black') || (seat === 2 && goState.nextPlayer === 'white'));
  const canPlayXiangqi =
    xiangqiTurn &&
    ((seat === 1 && xiangqiState.nextPlayer === 'red') ||
      (seat === 2 && xiangqiState.nextPlayer === 'black'));

  useEffect(() => {
    if (!roomId) {
      return;
    }

    send({
      type: 'room.subscribe',
      payload: { roomId, asSpectator: watchMode }
    });

    api
      .getRoom(roomId)
      .then((result) => {
        setFallbackRoom(result.room);
        if (watchMode) {
          api.joinRoom(roomId, true).catch(() => {
            // Spectator persistence is best effort.
          });
        }
      })
      .catch((err) => {
        setError(translateError(err instanceof Error ? err.message : t('common.error_generic')));
      });

    return () => {
      send({
        type: 'room.unsubscribe',
        payload: { roomId }
      });
    };
  }, [api, roomId, send, t, translateError, watchMode]);

  useEffect(() => {
    if (!realtime.lastError) {
      return;
    }

    setError(translateError(realtime.lastError));
    realtime.clearLastError();
  }, [realtime, translateError]);

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

  if (!room) {
    return <main className="panel">{t('room.loading')}</main>;
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
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              await api.leaveRoom(room.id);
              navigate('/');
            }}
          >
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

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>{t('room.game.title')}</h2>

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
            <p>
              {t('room.next_turn', {
                player: colorLabel(gomokuState.nextPlayer),
                status: statusLabel(gomokuState.status)
              })}
            </p>
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

        {room.gameType === 'go' ? (
          <>
            <p>
              {t('room.next_turn', {
                player: colorLabel(goState.nextPlayer),
                status: statusLabel(goState.status)
              })}
            </p>
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

        {room.gameType === 'xiangqi' ? (
          <>
            <p>
              {t('room.next_turn', {
                player: colorLabel(xiangqiState.nextPlayer),
                status: statusLabel(xiangqiState.status)
              })}
            </p>
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
