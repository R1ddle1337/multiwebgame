import type { MatchDTO, RoomDTO, UserDTO } from '@multiwebgame/shared-types';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useRealtime } from '../context/RealtimeContext';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
  user: UserDTO;
}

export function LobbyPage({ api, user }: Props) {
  const realtime = useRealtime();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomDTO[]>([]);
  const [history, setHistory] = useState<MatchDTO[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQueueing, setIsQueueing] = useState(false);

  const pendingInvites = useMemo(
    () => realtime.invitations.filter((invitation) => invitation.toUserId === user.id && invitation.status === 'pending'),
    [realtime.invitations, user.id]
  );

  useEffect(() => {
    let active = true;

    api
      .listRooms()
      .then((result) => {
        if (active) {
          setRooms(result.rooms);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load rooms');
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRooms(false);
        }
      });

    api
      .matchHistory(20)
      .then((result) => {
        if (active) {
          setHistory(result.matches);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingHistory(false);
        }
      });

    api
      .listInvitations()
      .then((result) => {
        if (active) {
          realtime.setInvitations(result.invitations);
        }
      })
      .catch(() => {
        // Non-critical for first paint.
      });

    return () => {
      active = false;
    };
  }, [api, realtime]);

  const createGomokuRoom = async () => {
    const result = await api.createRoom('gomoku');
    navigate(`/rooms/${result.room.id}`);
  };

  const joinRoom = async (roomId: string) => {
    await api.joinRoom(roomId);
    navigate(`/rooms/${roomId}`);
  };

  return (
    <main className="content-grid">
      <section className="panel">
        <h2>Lobby</h2>
        <p>Open rooms and live presence for quick match setup.</p>
        <div className="button-row">
          <button type="button" onClick={createGomokuRoom}>
            Create Gomoku Room
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/game/2048')}>
            Play 2048 Solo
          </button>
        </div>

        <div className="matchmaking">
          <h3>2-Player Matchmaking</h3>
          <p>Queue Size: {realtime.queueSize}</p>
          {isQueueing ? (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                realtime.send({ type: 'matchmaking.leave', payload: {} });
                setIsQueueing(false);
              }}
            >
              Leave Queue
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                realtime.send({ type: 'matchmaking.join', payload: { gameType: 'gomoku' } });
                setIsQueueing(true);
              }}
            >
              Join Queue
            </button>
          )}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <h3>Open Rooms</h3>
        {loadingRooms ? <p>Loading rooms...</p> : null}
        <div className="card-list">
          {rooms.map((room) => (
            <article className="card" key={room.id}>
              <div>
                <strong>{room.gameType === 'gomoku' ? 'Gomoku' : '2048'}</strong>
                <p>
                  {room.players.length}/
                  {room.gameType === 'gomoku' ? 2 : 1} players
                </p>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => joinRoom(room.id)}>
                  Join
                </button>
              </div>
            </article>
          ))}
          {rooms.length === 0 && !loadingRooms ? <p>No open rooms yet.</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Presence + Invites</h2>
        <h3>Online</h3>
        <ul className="simple-list">
          {realtime.onlineUsers.map((online) => (
            <li key={online.userId}>
              {online.displayName} <code>{online.userId.slice(0, 8)}</code>
            </li>
          ))}
          {realtime.onlineUsers.length === 0 ? <li>No users online</li> : null}
        </ul>

        <h3>Pending Invites</h3>
        <div className="card-list">
          {pendingInvites.map((invite) => (
            <article className="card" key={invite.id}>
              <p>
                Room <code>{invite.roomId.slice(0, 8)}</code> from <code>{invite.fromUserId.slice(0, 8)}</code>
              </p>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() =>
                    realtime.send({
                      type: 'invite.respond',
                      payload: { invitationId: invite.id, action: 'accept' }
                    })
                  }
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    realtime.send({
                      type: 'invite.respond',
                      payload: { invitationId: invite.id, action: 'decline' }
                    })
                  }
                >
                  Decline
                </button>
              </div>
            </article>
          ))}
          {pendingInvites.length === 0 ? <p>No pending invites.</p> : null}
        </div>

        <h3>Match History</h3>
        {loadingHistory ? <p>Loading history...</p> : null}
        <ul className="simple-list">
          {history.map((match) => (
            <li key={match.id}>
              {match.gameType} • {match.status} • <Link to={`/matches/${match.id}/replay`}>Replay</Link>
            </li>
          ))}
          {history.length === 0 && !loadingHistory ? <li>No match history yet.</li> : null}
        </ul>
      </section>
    </main>
  );
}
