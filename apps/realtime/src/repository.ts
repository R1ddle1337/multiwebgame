import type {
  GameType,
  InvitationDTO,
  MatchDTO,
  MatchMoveDTO,
  RoomDTO,
  RoomPlayerDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import type { PoolClient } from 'pg';

import { pool, withTransaction } from './db.js';

type DbExecutor = Pick<PoolClient, 'query'>;

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapUser(row: {
  id: string;
  display_name: string;
  is_guest: boolean;
  rating: number | null;
  created_at: Date | string;
}): UserDTO {
  return {
    id: row.id,
    displayName: row.display_name,
    isGuest: row.is_guest,
    rating: row.rating ?? 1200,
    createdAt: toIso(row.created_at)
  };
}

function mapInvitation(row: {
  id: string;
  room_id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: Date | string;
  responded_at: Date | string | null;
}): InvitationDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    status: row.status,
    createdAt: toIso(row.created_at),
    respondedAt: row.responded_at ? toIso(row.responded_at) : null
  };
}

function mapMatchMove(row: {
  id: string;
  match_id: string;
  move_index: number;
  actor_user_id: string;
  move_type: string;
  payload: Record<string, unknown>;
  created_at: Date | string;
}): MatchMoveDTO {
  return {
    id: row.id,
    matchId: row.match_id,
    moveIndex: row.move_index,
    actorUserId: row.actor_user_id,
    moveType: row.move_type,
    payload: row.payload,
    createdAt: toIso(row.created_at)
  };
}

function mapMatch(row: {
  id: string;
  room_id: string;
  game_type: GameType;
  status: 'active' | 'completed' | 'abandoned';
  winner_user_id: string | null;
  started_at: Date | string;
  ended_at: Date | string | null;
}): MatchDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    gameType: row.game_type,
    status: row.status,
    winnerUserId: row.winner_user_id,
    startedAt: toIso(row.started_at),
    endedAt: row.ended_at ? toIso(row.ended_at) : null,
    moves: []
  };
}

async function fetchRoomById(client: DbExecutor, roomId: string): Promise<RoomDTO | null> {
  const roomResult = await client.query<{
    id: string;
    host_user_id: string;
    game_type: GameType;
    status: 'open' | 'in_match' | 'closed';
    created_at: Date | string;
  }>(
    `
      SELECT id, host_user_id, game_type, status, created_at
      FROM rooms
      WHERE id = $1
      LIMIT 1
    `,
    [roomId]
  );

  const room = roomResult.rows[0];
  if (!room) {
    return null;
  }

  const players = await client.query<{
    id: string;
    room_id: string;
    user_id: string;
    seat: number;
    joined_at: Date | string;
    left_at: Date | string | null;
    display_name: string;
    is_guest: boolean;
    rating: number | null;
    created_at: Date | string;
  }>(
    `
      SELECT
        rp.id,
        rp.room_id,
        rp.user_id,
        rp.seat,
        rp.joined_at,
        rp.left_at,
        u.display_name,
        u.is_guest,
        u.created_at,
        rt.rating
      FROM room_players rp
      JOIN users u ON u.id = rp.user_id
      LEFT JOIN ratings rt ON rt.user_id = u.id AND rt.game_type = 'gomoku'
      WHERE rp.room_id = $1 AND rp.left_at IS NULL
      ORDER BY rp.seat ASC
    `,
    [roomId]
  );

  const mappedPlayers: RoomPlayerDTO[] = players.rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    seat: row.seat,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at ? toIso(row.left_at) : null,
    user: mapUser(row)
  }));

  return {
    id: room.id,
    hostUserId: room.host_user_id,
    gameType: room.game_type,
    status: room.status,
    createdAt: toIso(room.created_at),
    players: mappedPlayers
  };
}

export async function getUserFromSession(sessionId: string, userId: string): Promise<UserDTO | null> {
  const result = await pool.query<{
    id: string;
    display_name: string;
    is_guest: boolean;
    rating: number | null;
    created_at: Date | string;
  }>(
    `
      SELECT
        u.id,
        u.display_name,
        u.is_guest,
        u.created_at,
        rt.rating
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN ratings rt ON rt.user_id = u.id AND rt.game_type = 'gomoku'
      WHERE s.id = $1 AND s.user_id = $2 AND s.expires_at > NOW()
      LIMIT 1
    `,
    [sessionId, userId]
  );

  const row = result.rows[0];
  return row ? mapUser(row) : null;
}

export async function getRoom(roomId: string): Promise<RoomDTO | null> {
  return fetchRoomById(pool, roomId);
}

export async function createMatchmakingRoom(userAId: string, userBId: string): Promise<{ room: RoomDTO; matchId: string }> {
  return withTransaction(async (client) => {
    const roomResult = await client.query<{ id: string }>(
      `
        INSERT INTO rooms (host_user_id, game_type, status)
        VALUES ($1, 'gomoku', 'in_match')
        RETURNING id
      `,
      [userAId]
    );

    const roomId = roomResult.rows[0].id;

    await client.query(
      `
        INSERT INTO room_players (room_id, user_id, seat)
        VALUES
          ($1, $2, 1),
          ($1, $3, 2)
      `,
      [roomId, userAId, userBId]
    );

    const matchResult = await client.query<{ id: string }>(
      `
        INSERT INTO matches (room_id, game_type, status)
        VALUES ($1, 'gomoku', 'active')
        RETURNING id
      `,
      [roomId]
    );

    const room = await fetchRoomById(client, roomId);
    if (!room) {
      throw new Error('failed_to_load_room');
    }

    return { room, matchId: matchResult.rows[0].id };
  });
}

export async function createMatchForRoom(roomId: string): Promise<string> {
  return withTransaction(async (client) => {
    await client.query(`UPDATE rooms SET status = 'in_match' WHERE id = $1`, [roomId]);
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO matches (room_id, game_type, status)
        VALUES ($1, 'gomoku', 'active')
        RETURNING id
      `,
      [roomId]
    );
    return result.rows[0].id;
  });
}

export async function getLatestMatchForRoom(roomId: string): Promise<MatchDTO | null> {
  const result = await pool.query<{
    id: string;
    room_id: string;
    game_type: GameType;
    status: 'active' | 'completed' | 'abandoned';
    winner_user_id: string | null;
    started_at: Date | string;
    ended_at: Date | string | null;
  }>(
    `
      SELECT id, room_id, game_type, status, winner_user_id, started_at, ended_at
      FROM matches
      WHERE room_id = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    [roomId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const match = mapMatch(row);
  match.moves = await getMatchMoves(match.id);
  return match;
}

export async function createMatchMove(params: {
  matchId: string;
  actorUserId: string;
  moveIndex: number;
  moveType: string;
  payload: Record<string, unknown>;
}): Promise<MatchMoveDTO> {
  const result = await pool.query<{
    id: string;
    match_id: string;
    move_index: number;
    actor_user_id: string;
    move_type: string;
    payload: Record<string, unknown>;
    created_at: Date | string;
  }>(
    `
      INSERT INTO match_moves (match_id, move_index, actor_user_id, move_type, payload)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, match_id, move_index, actor_user_id, move_type, payload, created_at
    `,
    [params.matchId, params.moveIndex, params.actorUserId, params.moveType, params.payload]
  );

  return mapMatchMove(result.rows[0]);
}

export async function completeMatch(params: {
  matchId: string;
  roomId: string;
  winnerUserId: string | null;
  status: 'completed' | 'abandoned';
}): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `
        UPDATE matches
        SET status = $1, winner_user_id = $2, ended_at = NOW()
        WHERE id = $3
      `,
      [params.status, params.winnerUserId, params.matchId]
    );

    await client.query(
      `
        UPDATE rooms
        SET status = 'open'
        WHERE id = $1
      `,
      [params.roomId]
    );
  });
}

export async function getMatchMoves(matchId: string): Promise<MatchMoveDTO[]> {
  const result = await pool.query<{
    id: string;
    match_id: string;
    move_index: number;
    actor_user_id: string;
    move_type: string;
    payload: Record<string, unknown>;
    created_at: Date | string;
  }>(
    `
      SELECT id, match_id, move_index, actor_user_id, move_type, payload, created_at
      FROM match_moves
      WHERE match_id = $1
      ORDER BY move_index ASC
    `,
    [matchId]
  );

  return result.rows.map(mapMatchMove);
}

export async function listPendingInvitationsForUser(userId: string): Promise<InvitationDTO[]> {
  const result = await pool.query<{
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    created_at: Date | string;
    responded_at: Date | string | null;
  }>(
    `
      SELECT id, room_id, from_user_id, to_user_id, status, created_at, responded_at
      FROM invitations
      WHERE to_user_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId]
  );

  return result.rows.map(mapInvitation);
}

export async function respondToInvitation(params: {
  invitationId: string;
  userId: string;
  action: 'accept' | 'decline';
}): Promise<InvitationDTO | null> {
  const nextStatus = params.action === 'accept' ? 'accepted' : 'declined';

  const result = await pool.query<{
    id: string;
    room_id: string;
    from_user_id: string;
    to_user_id: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    created_at: Date | string;
    responded_at: Date | string | null;
  }>(
    `
      UPDATE invitations
      SET status = $1, responded_at = NOW()
      WHERE id = $2 AND to_user_id = $3 AND status = 'pending'
      RETURNING id, room_id, from_user_id, to_user_id, status, created_at, responded_at
    `,
    [nextStatus, params.invitationId, params.userId]
  );

  const row = result.rows[0];
  return row ? mapInvitation(row) : null;
}

export async function joinRoomIfPossible(roomId: string, userId: string): Promise<RoomDTO | null> {
  return withTransaction(async (client) => {
    const roomResult = await client.query<{
      id: string;
      game_type: GameType;
      status: 'open' | 'in_match' | 'closed';
    }>(
      'SELECT id, game_type, status FROM rooms WHERE id = $1 FOR UPDATE',
      [roomId]
    );

    const room = roomResult.rows[0];
    if (!room || room.status === 'closed') {
      return null;
    }

    const existing = await client.query('SELECT id FROM room_players WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL', [
      roomId,
      userId
    ]);

    if (existing.rowCount === 0) {
      const maxPlayers = room.game_type === 'gomoku' ? 2 : 1;
      const seats = await client.query<{ seat: number }>(
        'SELECT seat FROM room_players WHERE room_id = $1 AND left_at IS NULL ORDER BY seat ASC',
        [roomId]
      );

      if (seats.rows.length >= maxPlayers) {
        return null;
      }

      const used = new Set(seats.rows.map((row) => row.seat));
      let seat = 1;
      while (used.has(seat) && seat <= maxPlayers) {
        seat += 1;
      }

      await client.query('INSERT INTO room_players (room_id, user_id, seat) VALUES ($1, $2, $3)', [roomId, userId, seat]);
    }

    return fetchRoomById(client, roomId);
  });
}

export async function close(): Promise<void> {
  await pool.end();
}
