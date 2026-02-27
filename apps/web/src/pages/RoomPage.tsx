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
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const realtime = useRealtime();

  const [fallbackRoom, setFallbackRoom] = useState<RoomDTO | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [xiangqiSelection, setXiangqiSelection] = useState<{ x: number; y: number } | null>(null);

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

    realtime.send({
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
        setError(err instanceof Error ? err.message : 'Failed to load room');
      });
  }, [api, realtime, roomId, watchMode]);

  const sendGomokuMove = (x: number, y: number) => {
    if (!canPlayGomoku) {
      return;
    }

    realtime.send({
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

    realtime.send({
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

    realtime.send({
      type: 'room.move',
      payload: {
        roomId,
        gameType: 'xiangqi',
        move
      }
    });
  };

  if (!room) {
    return <main className="panel">Loading room...</main>;
  }

  return (
    <main className="content-grid room-layout">
      <section className="panel">
        <h2>Room {room.id.slice(0, 8)}</h2>
        <p>
          Game: <strong>{room.gameType}</strong> • Status: <strong>{room.status}</strong> • View:{' '}
          <strong>{viewerRole}</strong>
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
            Leave Room
          </button>
          {viewerRole !== 'spectator' ? null : (
            <button
              type="button"
              onClick={async () => {
                await api.joinRoom(room.id, false);
                realtime.send({ type: 'room.subscribe', payload: { roomId: room.id } });
              }}
            >
              Try Join As Player
            </button>
          )}
        </div>

        <h3>
          Participants ({room.players.length}/{room.maxPlayers})
        </h3>
        <ul className="simple-list">
          {room.players.map((player) => (
            <li key={player.id}>
              {player.role.toUpperCase()} {player.seat ? `Seat ${player.seat}` : ''}:{' '}
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
                      .then(() => setError('Report submitted.'))
                      .catch((err) => setError(err instanceof Error ? err.message : 'Report failed'));
                  }}
                >
                  Report
                </button>
              )}
            </li>
          ))}
        </ul>

        <h3>Invite User By ID</h3>
        <form
          className="inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api.createInvitation(room.id, inviteUserId.trim());
              setInviteUserId('');
              setError(null);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Invite failed');
            }
          }}
        >
          <input
            value={inviteUserId}
            onChange={(event) => setInviteUserId(event.target.value)}
            placeholder="target user UUID"
          />
          <button type="submit">Send Invite</button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="panel">
        <h2>Game</h2>

        {room.gameType === 'single_2048' ? (
          <p>
            This room uses solo 2048 mode. Open{' '}
            <button type="button" onClick={() => navigate('/game/2048')}>
              2048 page
            </button>
            .
          </p>
        ) : null}

        {room.gameType === 'gomoku' ? (
          <>
            <p>
              Next turn: <strong>{gomokuState.nextPlayer}</strong> • Status:{' '}
              <strong>{gomokuState.status}</strong>
            </p>
            <GomokuBoard state={gomokuState} disabled={!canPlayGomoku} onCellClick={sendGomokuMove} />
            {gomokuState.winner ? <p>Winner: {gomokuState.winner}</p> : null}
          </>
        ) : null}

        {room.gameType === 'go' ? (
          <>
            <p>
              Next turn: <strong>{goState.nextPlayer}</strong> • Status: <strong>{goState.status}</strong>
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
                Pass
              </button>
            </div>
          </>
        ) : null}

        {room.gameType === 'xiangqi' ? (
          <>
            <p>
              Next turn: <strong>{xiangqiState.nextPlayer}</strong> • Status:{' '}
              <strong>{xiangqiState.status}</strong>
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
            {xiangqiState.winner ? <p>Winner: {xiangqiState.winner}</p> : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
