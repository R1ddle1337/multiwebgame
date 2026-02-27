import type {
  GameType,
  InvitationDTO,
  MatchDTO,
  MatchMoveDTO,
  RoomDTO,
  RoomPlayerDTO,
  SessionDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import type { PoolClient } from 'pg';

import { pool, withTransaction } from '../db.js';

import { StoreError, type Store } from './types.js';

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

function mapSession(row: {
  id: string;
  user_id: string;
  created_at: Date | string;
  expires_at: Date | string;
}): SessionDTO {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: toIso(row.created_at),
    expiresAt: toIso(row.expires_at)
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

async function ensureRating(client: DbExecutor, userId: string, gameType = 'gomoku'): Promise<void> {
  await client.query(
    `
      INSERT INTO ratings (user_id, game_type, rating)
      VALUES ($1, $2, 1200)
      ON CONFLICT (user_id, game_type) DO NOTHING
    `,
    [userId, gameType]
  );
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
    `,
    [roomId]
  );

  const roomRow = roomResult.rows[0];
  if (!roomRow) {
    return null;
  }

  const playersResult = await client.query<{
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

  const players: RoomPlayerDTO[] = playersResult.rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    seat: row.seat,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at ? toIso(row.left_at) : null,
    user: mapUser(row)
  }));

  return {
    id: roomRow.id,
    hostUserId: roomRow.host_user_id,
    gameType: roomRow.game_type,
    status: roomRow.status,
    createdAt: toIso(roomRow.created_at),
    players
  };
}

async function loadMovesForMatches(client: DbExecutor, matchIds: string[]): Promise<Map<string, MatchMoveDTO[]>> {
  if (matchIds.length === 0) {
    return new Map();
  }

  const result = await client.query<{
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
      WHERE match_id = ANY($1::uuid[])
      ORDER BY move_index ASC
    `,
    [matchIds]
  );

  const grouped = new Map<string, MatchMoveDTO[]>();
  for (const row of result.rows) {
    const mapped = mapMatchMove(row);
    const existing = grouped.get(mapped.matchId) ?? [];
    existing.push(mapped);
    grouped.set(mapped.matchId, existing);
  }

  return grouped;
}

export function createPostgresStore(): Store {
  return {
    async createGuestUser(displayName: string): Promise<UserDTO> {
      return withTransaction(async (client) => {
        const created = await client.query<{
          id: string;
          display_name: string;
          is_guest: boolean;
          created_at: Date | string;
        }>(
          `
            INSERT INTO users (display_name, is_guest)
            VALUES ($1, TRUE)
            RETURNING id, display_name, is_guest, created_at
          `,
          [displayName]
        );

        const row = created.rows[0];
        await ensureRating(client, row.id, 'gomoku');
        return mapUser({ ...row, rating: 1200 });
      });
    },

    async createRegisteredUser(params): Promise<UserDTO> {
      return withTransaction(async (client) => {
        const created = await client.query<{
          id: string;
          display_name: string;
          is_guest: boolean;
          created_at: Date | string;
        }>(
          `
            INSERT INTO users (display_name, email, password_hash, is_guest)
            VALUES ($1, $2, $3, FALSE)
            RETURNING id, display_name, is_guest, created_at
          `,
          [params.displayName, params.email.toLowerCase(), params.passwordHash]
        );

        const row = created.rows[0];
        await ensureRating(client, row.id, 'gomoku');
        return mapUser({ ...row, rating: 1200 });
      }).catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code: string }).code === '23505'
        ) {
          throw new StoreError('Email already registered', 'conflict');
        }
        throw error;
      });
    },

    async findUserByEmail(email: string): Promise<{ user: UserDTO; passwordHash: string } | null> {
      const result = await pool.query<{
        id: string;
        display_name: string;
        password_hash: string | null;
        is_guest: boolean;
        created_at: Date | string;
        rating: number | null;
      }>(
        `
          SELECT
            u.id,
            u.display_name,
            u.password_hash,
            u.is_guest,
            u.created_at,
            rt.rating
          FROM users u
          LEFT JOIN ratings rt ON rt.user_id = u.id AND rt.game_type = 'gomoku'
          WHERE u.email = $1
          LIMIT 1
        `,
        [email.toLowerCase()]
      );

      const row = result.rows[0];
      if (!row || !row.password_hash) {
        return null;
      }

      return {
        user: mapUser(row),
        passwordHash: row.password_hash
      };
    },

    async getUserById(userId: string): Promise<UserDTO | null> {
      const result = await pool.query<{
        id: string;
        display_name: string;
        is_guest: boolean;
        created_at: Date | string;
        rating: number | null;
      }>(
        `
          SELECT
            u.id,
            u.display_name,
            u.is_guest,
            u.created_at,
            rt.rating
          FROM users u
          LEFT JOIN ratings rt ON rt.user_id = u.id AND rt.game_type = 'gomoku'
          WHERE u.id = $1
          LIMIT 1
        `,
        [userId]
      );

      const row = result.rows[0];
      return row ? mapUser(row) : null;
    },

    async createSession(userId: string): Promise<SessionDTO> {
      const result = await pool.query<{
        id: string;
        user_id: string;
        created_at: Date | string;
        expires_at: Date | string;
      }>(
        `
          INSERT INTO sessions (user_id, expires_at)
          VALUES ($1, NOW() + INTERVAL '30 days')
          RETURNING id, user_id, created_at, expires_at
        `,
        [userId]
      );

      return mapSession(result.rows[0]);
    },

    async getSessionById(sessionId: string): Promise<SessionDTO | null> {
      const result = await pool.query<{
        id: string;
        user_id: string;
        created_at: Date | string;
        expires_at: Date | string;
      }>(
        `
          SELECT id, user_id, created_at, expires_at
          FROM sessions
          WHERE id = $1 AND expires_at > NOW()
          LIMIT 1
        `,
        [sessionId]
      );

      const row = result.rows[0];
      return row ? mapSession(row) : null;
    },

    async deleteSession(sessionId: string): Promise<void> {
      await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
    },

    async listOpenRooms(): Promise<RoomDTO[]> {
      const rooms = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM rooms
          WHERE status = 'open'
          ORDER BY created_at DESC
          LIMIT 100
        `
      );

      const result: RoomDTO[] = [];
      for (const row of rooms.rows) {
        const room = await fetchRoomById(pool, row.id);
        if (room) {
          result.push(room);
        }
      }

      return result;
    },

    async getRoomById(roomId: string): Promise<RoomDTO | null> {
      return fetchRoomById(pool, roomId);
    },

    async createRoom(hostUserId: string, gameType: GameType): Promise<RoomDTO> {
      return withTransaction(async (client) => {
        const roomResult = await client.query<{ id: string }>(
          `
            INSERT INTO rooms (host_user_id, game_type, status)
            VALUES ($1, $2, 'open')
            RETURNING id
          `,
          [hostUserId, gameType]
        );

        const roomId = roomResult.rows[0].id;
        await client.query(
          `
            INSERT INTO room_players (room_id, user_id, seat)
            VALUES ($1, $2, 1)
          `,
          [roomId, hostUserId]
        );

        const room = await fetchRoomById(client, roomId);
        if (!room) {
          throw new StoreError('Room not found after creation', 'not_found');
        }

        return room;
      });
    },

    async joinRoom(roomId: string, userId: string): Promise<RoomDTO> {
      return withTransaction(async (client) => {
        const roomResult = await client.query<{
          id: string;
          game_type: GameType;
          status: 'open' | 'in_match' | 'closed';
        }>(
          `
            SELECT id, game_type, status
            FROM rooms
            WHERE id = $1
            FOR UPDATE
          `,
          [roomId]
        );

        const room = roomResult.rows[0];
        if (!room) {
          throw new StoreError('Room not found', 'not_found');
        }

        if (room.status !== 'open') {
          throw new StoreError('Room is not open', 'forbidden');
        }

        const existing = await client.query(
          `
            SELECT id
            FROM room_players
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
            LIMIT 1
          `,
          [roomId, userId]
        );

        if (existing.rowCount && existing.rowCount > 0) {
          const current = await fetchRoomById(client, roomId);
          if (!current) {
            throw new StoreError('Room not found', 'not_found');
          }
          return current;
        }

        const maxPlayers = room.game_type === 'gomoku' ? 2 : 1;

        const activePlayers = await client.query<{ seat: number }>(
          `
            SELECT seat
            FROM room_players
            WHERE room_id = $1 AND left_at IS NULL
            ORDER BY seat ASC
          `,
          [roomId]
        );

        if (activePlayers.rows.length >= maxPlayers) {
          throw new StoreError('Room capacity reached', 'capacity_reached');
        }

        const usedSeats = new Set(activePlayers.rows.map((row) => row.seat));
        let nextSeat = 1;
        while (usedSeats.has(nextSeat) && nextSeat <= maxPlayers) {
          nextSeat += 1;
        }

        await client.query(
          `
            INSERT INTO room_players (room_id, user_id, seat)
            VALUES ($1, $2, $3)
          `,
          [roomId, userId, nextSeat]
        );

        const updatedRoom = await fetchRoomById(client, roomId);
        if (!updatedRoom) {
          throw new StoreError('Room not found', 'not_found');
        }

        return updatedRoom;
      });
    },

    async leaveRoom(roomId: string, userId: string): Promise<RoomDTO | null> {
      return withTransaction(async (client) => {
        const roomResult = await client.query<{ id: string; host_user_id: string }>(
          `
            SELECT id, host_user_id
            FROM rooms
            WHERE id = $1
            FOR UPDATE
          `,
          [roomId]
        );

        const room = roomResult.rows[0];
        if (!room) {
          throw new StoreError('Room not found', 'not_found');
        }

        const left = await client.query(
          `
            UPDATE room_players
            SET left_at = NOW()
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
            RETURNING id
          `,
          [roomId, userId]
        );

        if (!left.rowCount) {
          throw new StoreError('User is not in room', 'not_found');
        }

        const activePlayers = await client.query<{ user_id: string; seat: number }>(
          `
            SELECT user_id, seat
            FROM room_players
            WHERE room_id = $1 AND left_at IS NULL
            ORDER BY seat ASC
          `,
          [roomId]
        );

        if (activePlayers.rows.length === 0) {
          await client.query(`UPDATE rooms SET status = 'closed' WHERE id = $1`, [roomId]);
          return null;
        }

        if (room.host_user_id === userId) {
          await client.query(`UPDATE rooms SET host_user_id = $1 WHERE id = $2`, [activePlayers.rows[0].user_id, roomId]);
        }

        const updatedRoom = await fetchRoomById(client, roomId);
        if (!updatedRoom) {
          throw new StoreError('Room not found', 'not_found');
        }

        return updatedRoom;
      });
    },

    async createInvitation(params): Promise<InvitationDTO> {
      if (params.fromUserId === params.toUserId) {
        throw new StoreError('Cannot invite yourself', 'validation_error');
      }

      return withTransaction(async (client) => {
        const roomResult = await client.query<{ id: string }>('SELECT id FROM rooms WHERE id = $1', [params.roomId]);
        if (roomResult.rows.length === 0) {
          throw new StoreError('Room not found', 'not_found');
        }

        const targetUser = await client.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [params.toUserId]);
        if (targetUser.rows.length === 0) {
          throw new StoreError('Invite target user not found', 'not_found');
        }

        const insert = await client.query<{
          id: string;
          room_id: string;
          from_user_id: string;
          to_user_id: string;
          status: 'pending' | 'accepted' | 'declined' | 'expired';
          created_at: Date | string;
          responded_at: Date | string | null;
        }>(
          `
            INSERT INTO invitations (room_id, from_user_id, to_user_id, status)
            VALUES ($1, $2, $3, 'pending')
            RETURNING id, room_id, from_user_id, to_user_id, status, created_at, responded_at
          `,
          [params.roomId, params.fromUserId, params.toUserId]
        );

        return mapInvitation(insert.rows[0]);
      });
    },

    async listInvitationsForUser(userId: string): Promise<InvitationDTO[]> {
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
          WHERE to_user_id = $1 OR from_user_id = $1
          ORDER BY created_at DESC
          LIMIT 100
        `,
        [userId]
      );

      return result.rows.map(mapInvitation);
    },

    async respondInvitation(params): Promise<InvitationDTO> {
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
      if (!row) {
        throw new StoreError('Invitation not found or already handled', 'not_found');
      }

      return mapInvitation(row);
    },

    async listMatchHistoryForUser(userId: string, limit: number): Promise<MatchDTO[]> {
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
          SELECT DISTINCT
            m.id,
            m.room_id,
            m.game_type,
            m.status,
            m.winner_user_id,
            m.started_at,
            m.ended_at
          FROM matches m
          JOIN room_players rp ON rp.room_id = m.room_id
          WHERE rp.user_id = $1
          ORDER BY m.started_at DESC
          LIMIT $2
        `,
        [userId, limit]
      );

      const matches = result.rows.map(mapMatch);
      const movesByMatch = await loadMovesForMatches(pool, matches.map((match) => match.id));

      for (const match of matches) {
        match.moves = movesByMatch.get(match.id) ?? [];
      }

      return matches;
    },

    async getMatchById(matchId: string): Promise<MatchDTO | null> {
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
          WHERE id = $1
          LIMIT 1
        `,
        [matchId]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const match = mapMatch(row);
      const moves = await loadMovesForMatches(pool, [match.id]);
      match.moves = moves.get(match.id) ?? [];
      return match;
    }
  };
}
