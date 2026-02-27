import type { BoardGameType, MatchDTO, RatingDTO, RoomDTO, UserDTO } from '@multiwebgame/shared-types';
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
  const [ratings, setRatings] = useState<RatingDTO[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQueueGame, setActiveQueueGame] = useState<BoardGameType | null>(null);
  const [blockUserId, setBlockUserId] = useState('');

  const pendingInvites = useMemo(
    () =>
      realtime.invitations.filter(
        (invitation) => invitation.toUserId === user.id && invitation.status === 'pending'
      ),
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
      .matchHistory(30)
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
      .listRatings()
      .then((result) => {
        if (active) {
          setRatings(result.ratings);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRatings(false);
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

  useEffect(() => {
    if (realtime.matchmakingTimeout) {
      setError(`Matchmaking timed out for ${realtime.matchmakingTimeout}.`);
      setActiveQueueGame(null);
      realtime.clearMatchmakingTimeout();
    }
  }, [realtime]);

  const createRoom = async (gameType: RoomDTO['gameType']) => {
    const result = await api.createRoom(gameType, gameType === 'single_2048' ? 1 : 4);
    navigate(`/rooms/${result.room.id}`);
  };

  const joinRoom = async (roomId: string) => {
    await api.joinRoom(roomId, false);
    navigate(`/rooms/${roomId}`);
  };

  const queueForGame = (gameType: BoardGameType) => {
    if (activeQueueGame === gameType) {
      realtime.send({ type: 'matchmaking.leave', payload: {} });
      setActiveQueueGame(null);
      return;
    }

    if (activeQueueGame) {
      realtime.send({ type: 'matchmaking.leave', payload: {} });
    }

    realtime.send({ type: 'matchmaking.join', payload: { gameType } });
    setActiveQueueGame(gameType);
  };

  return (
    <main className="content-grid lobby-layout">
      <section className="panel">
        <h2>Lobby</h2>
        <p>Open rooms, live spectators, and multi-mode matchmaking.</p>

        <div className="button-row">
          <button type="button" onClick={() => createRoom('gomoku')}>
            Create Gomoku Room
          </button>
          <button type="button" onClick={() => createRoom('go')}>
            Create Go Room
          </button>
          <button type="button" onClick={() => createRoom('xiangqi')}>
            Create Xiangqi Room
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/training')}>
            Training Mode
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/game/2048')}>
            2048 Solo
          </button>
        </div>

        <div className="matchmaking">
          <h3>Matchmaking</h3>
          <div className="button-row">
            <button
              type="button"
              className={activeQueueGame === 'gomoku' ? '' : 'secondary'}
              onClick={() => queueForGame('gomoku')}
            >
              {activeQueueGame === 'gomoku' ? 'Leave Gomoku Queue' : 'Queue Gomoku'} (
              {realtime.queueSizes.gomoku})
            </button>
            <button
              type="button"
              className={activeQueueGame === 'go' ? '' : 'secondary'}
              onClick={() => queueForGame('go')}
            >
              {activeQueueGame === 'go' ? 'Leave Go Queue' : 'Queue Go'} ({realtime.queueSizes.go})
            </button>
            <button
              type="button"
              className={activeQueueGame === 'xiangqi' ? '' : 'secondary'}
              onClick={() => queueForGame('xiangqi')}
            >
              {activeQueueGame === 'xiangqi' ? 'Leave Xiangqi Queue' : 'Queue Xiangqi'} (
              {realtime.queueSizes.xiangqi})
            </button>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <h3>Open & Live Rooms</h3>
        {loadingRooms ? <p>Loading rooms...</p> : null}
        <div className="card-list">
          {rooms.map((room) => (
            <article className="card" key={room.id}>
              <div>
                <strong>{room.gameType}</strong>
                <p>
                  {room.players.length}/{room.maxPlayers} participants • {room.status}
                </p>
              </div>
              <div className="button-row">
                <button type="button" onClick={() => joinRoom(room.id)}>
                  Join
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => navigate(`/rooms/${room.id}?watch=1`)}
                >
                  Spectate
                </button>
              </div>
            </article>
          ))}
          {rooms.length === 0 && !loadingRooms ? <p>No open rooms yet.</p> : null}
        </div>
      </section>

      <section className="panel">
        <h2>Presence, Ratings, Moderation</h2>

        <h3>Online</h3>
        <ul className="simple-list">
          {realtime.onlineUsers.map((online) => (
            <li key={online.userId}>
              {online.displayName} <code>{online.userId.slice(0, 8)}</code>{' '}
              {online.userId === user.id ? null : (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    api
                      .reportUser({
                        targetUserId: online.userId,
                        reason: 'lobby report'
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
          {realtime.onlineUsers.length === 0 ? <li>No users online</li> : null}
        </ul>

        <h3>Block User</h3>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            api
              .blockUser({ userId: blockUserId.trim(), reason: 'manual block' })
              .then(() => {
                setError('User blocked.');
                setBlockUserId('');
              })
              .catch((err) => setError(err instanceof Error ? err.message : 'Block failed'));
          }}
        >
          <input
            value={blockUserId}
            onChange={(event) => setBlockUserId(event.target.value)}
            placeholder="user UUID"
          />
          <button type="submit">Block</button>
        </form>

        <h3>Pending Invites</h3>
        <div className="card-list">
          {pendingInvites.map((invite) => (
            <article className="card" key={invite.id}>
              <p>
                Room <code>{invite.roomId.slice(0, 8)}</code> from{' '}
                <code>{invite.fromUserId.slice(0, 8)}</code>
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

        <h3>Your Ratings</h3>
        {loadingRatings ? <p>Loading ratings...</p> : null}
        <ul className="simple-list">
          {ratings.map((entry) => (
            <li key={entry.gameType}>
              {entry.gameType}: <strong>{entry.rating}</strong>
            </li>
          ))}
          {ratings.length === 0 && !loadingRatings ? <li>No ratings yet.</li> : null}
        </ul>

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
