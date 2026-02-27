import { createGomokuState } from '@multiwebgame/game-engines';
import type { RoomDTO, UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { GomokuBoard } from '../components/GomokuBoard';
import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
  user: UserDTO;
}

export function RoomPage({ api, user }: Props) {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const realtime = useRealtime();

  const [fallbackRoom, setFallbackRoom] = useState<RoomDTO | null>(null);
  const [inviteUserId, setInviteUserId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const snapshot = realtime.roomStates[roomId];
  const room = snapshot?.room ?? fallbackRoom;
  const gomokuState = snapshot?.gomokuState ?? createGomokuState(15);

  const playerSeat = useMemo(() => room?.players.find((player) => player.userId === user.id)?.seat ?? null, [room, user.id]);
  const myMark = playerSeat === 1 ? 'black' : playerSeat === 2 ? 'white' : null;
  const isMyTurn = myMark === gomokuState.nextPlayer && gomokuState.status === 'playing';

  useEffect(() => {
    if (!roomId) {
      return;
    }

    realtime.send({
      type: 'room.subscribe',
      payload: { roomId }
    });

    api
      .getRoom(roomId)
      .then((result) => setFallbackRoom(result.room))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      });
  }, [api, realtime, roomId]);

  const sendMove = (x: number, y: number) => {
    if (!isMyTurn) {
      return;
    }

    realtime.send({
      type: 'room.move',
      payload: {
        roomId,
        x,
        y
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
          Game: <strong>{room.gameType}</strong> • Status: <strong>{room.status}</strong>
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
        </div>

        <h3>Players</h3>
        <ul className="simple-list">
          {room.players.map((player) => (
            <li key={player.id}>
              Seat {player.seat}: {player.user.displayName} {player.userId === user.id ? '(You)' : ''}
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
            This room uses the solo 2048 game mode. Open <button onClick={() => navigate('/game/2048')}>2048 page</button>.
          </p>
        ) : (
          <>
            <p>
              You are <strong>{myMark ?? 'spectator'}</strong>. Next turn: <strong>{gomokuState.nextPlayer}</strong>.
            </p>
            <GomokuBoard state={gomokuState} disabled={!isMyTurn} onCellClick={sendMove} />
            {gomokuState.winner ? <p>Winner: {gomokuState.winner}</p> : null}
          </>
        )}
      </section>
    </main>
  );
}
