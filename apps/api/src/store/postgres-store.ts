import type {
  BlockDTO,
  GameType,
  InvitationDTO,
  MatchDTO,
  MatchMoveDTO,
  RatingFormulaDTO,
  RatingDTO,
  ReportDTO,
  RoomDTO,
  RoomPlayerDTO,
  SessionDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import type { PoolClient } from 'pg';

import { pool, withTransaction } from '../db.js';

import { StoreError, type Store } from './types.js';

type DbExecutor = Pick<PoolClient, 'query'>;
type RatingMap = Partial<Record<GameType, number>>;

const ALL_GAME_TYPES: GameType[] = ['single_2048', 'gomoku', 'xiangqi', 'go'];
const INITIAL_RATING = 1200;
const ELO_K_FACTOR_BY_GAME: Record<GameType, number> = {
  single_2048: 24,
  gomoku: 24,
  xiangqi: 24,
  go: 24
};

function playerSlotsForGame(gameType: GameType): number {
  return gameType === 'single_2048' ? 1 : 2;
}

function defaultMaxPlayersForGame(gameType: GameType): number {
  return gameType === 'single_2048' ? 1 : 4;
}

function normalizeMaxPlayers(gameType: GameType, requested?: number): number {
  const slots = playerSlotsForGame(gameType);
  const fallback = defaultMaxPlayersForGame(gameType);
  const maxPlayers = requested ?? fallback;

  if (!Number.isInteger(maxPlayers) || maxPlayers < slots || maxPlayers > 8) {
    throw new StoreError(`maxPlayers must be between ${slots} and 8 for ${gameType}`, 'validation_error');
  }

  return maxPlayers;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function createDefaultRatings(): RatingMap {
  return {
    single_2048: INITIAL_RATING,
    gomoku: INITIAL_RATING,
    xiangqi: INITIAL_RATING,
    go: INITIAL_RATING
  };
}

function getRatingFormula(): RatingFormulaDTO[] {
  return ALL_GAME_TYPES.map((gameType) => ({
    gameType,
    system: 'elo',
    initialRating: INITIAL_RATING,
    kFactor: ELO_K_FACTOR_BY_GAME[gameType],
    expectedScore: '1 / (1 + 10^((opponent - player) / 400))'
  }));
}

function mapUser(
  row: {
    id: string;
    display_name: string;
    is_guest: boolean;
    is_admin: boolean;
    created_at: Date | string;
    rating?: number | null;
  },
  ratings: RatingMap
): UserDTO {
  const merged = {
    ...createDefaultRatings(),
    ...ratings
  };

  return {
    id: row.id,
    displayName: row.display_name,
    isGuest: row.is_guest,
    isAdmin: row.is_admin,
    rating: merged.gomoku ?? row.rating ?? INITIAL_RATING,
    ratings: merged,
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
  result_payload: Record<string, unknown> | null;
  started_at: Date | string;
  ended_at: Date | string | null;
}): MatchDTO {
  return {
    id: row.id,
    roomId: row.room_id,
    gameType: row.game_type,
    status: row.status,
    winnerUserId: row.winner_user_id,
    resultPayload: row.result_payload,
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

function mapRating(row: { game_type: GameType; rating: number; updated_at: Date | string }): RatingDTO {
  return {
    gameType: row.game_type,
    rating: row.rating,
    updatedAt: toIso(row.updated_at)
  };
}

function mapBlock(row: {
  id: string;
  blocker_user_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: Date | string;
}): BlockDTO {
  return {
    id: row.id,
    blockerUserId: row.blocker_user_id,
    blockedUserId: row.blocked_user_id,
    reason: row.reason,
    createdAt: toIso(row.created_at)
  };
}

function mapReport(row: {
  id: string;
  reporter_user_id: string;
  target_user_id: string | null;
  match_id: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: Date | string;
  updated_at: Date | string;
}): ReportDTO {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetUserId: row.target_user_id,
    matchId: row.match_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

async function ensureAllRatings(client: DbExecutor, userId: string): Promise<void> {
  await client.query(
    `
      INSERT INTO ratings (user_id, game_type, rating)
      SELECT $1, game_type, $3
      FROM UNNEST($2::text[]) AS game_type
      ON CONFLICT (user_id, game_type) DO NOTHING
    `,
    [userId, ALL_GAME_TYPES, INITIAL_RATING]
  );
}

async function fetchRatingsByUserId(client: DbExecutor, userIds: string[]): Promise<Map<string, RatingMap>> {
  const map = new Map<string, RatingMap>();

  for (const userId of userIds) {
    map.set(userId, createDefaultRatings());
  }

  if (userIds.length === 0) {
    return map;
  }

  const result = await client.query<{
    user_id: string;
    game_type: GameType;
    rating: number;
  }>(
    `
      SELECT user_id, game_type, rating
      FROM ratings
      WHERE user_id = ANY($1::uuid[])
    `,
    [userIds]
  );

  for (const row of result.rows) {
    const existing = map.get(row.user_id) ?? createDefaultRatings();
    existing[row.game_type] = row.rating;
    map.set(row.user_id, existing);
  }

  return map;
}

async function fetchRoomById(client: DbExecutor, roomId: string): Promise<RoomDTO | null> {
  const roomResult = await client.query<{
    id: string;
    host_user_id: string;
    game_type: GameType;
    status: 'open' | 'in_match' | 'closed';
    max_players: number;
    created_at: Date | string;
  }>(
    `
      SELECT id, host_user_id, game_type, status, max_players, created_at
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
    role: 'player' | 'spectator';
    seat: number | null;
    joined_at: Date | string;
    left_at: Date | string | null;
    display_name: string;
    is_guest: boolean;
    is_admin: boolean;
    created_at: Date | string;
  }>(
    `
      SELECT
        rp.id,
        rp.room_id,
        rp.user_id,
        rp.role,
        rp.seat,
        rp.joined_at,
        rp.left_at,
        u.display_name,
        u.is_guest,
        u.is_admin,
        u.created_at
      FROM room_players rp
      JOIN users u ON u.id = rp.user_id
      WHERE rp.room_id = $1 AND rp.left_at IS NULL
      ORDER BY CASE WHEN rp.seat IS NULL THEN 999 ELSE rp.seat END ASC, rp.joined_at ASC
    `,
    [roomId]
  );

  const ratingsByUserId = await fetchRatingsByUserId(
    client,
    playersResult.rows.map((row) => row.user_id)
  );

  const players: RoomPlayerDTO[] = playersResult.rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    role: row.role,
    seat: row.seat,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at ? toIso(row.left_at) : null,
    user: mapUser(row, ratingsByUserId.get(row.user_id) ?? createDefaultRatings())
  }));

  return {
    id: roomRow.id,
    hostUserId: roomRow.host_user_id,
    gameType: roomRow.game_type,
    status: roomRow.status,
    maxPlayers: roomRow.max_players,
    createdAt: toIso(roomRow.created_at),
    players
  };
}

async function abandonActiveMatches(
  client: DbExecutor,
  roomId: string,
  reason: 'required_player_left' | 'inactive_timeout' | 'room_empty' | 'stale_match_recovery'
): Promise<void> {
  await client.query(
    `
      UPDATE matches
      SET
        status = 'abandoned',
        winner_user_id = NULL,
        result_payload = COALESCE(result_payload, '{}'::jsonb) || jsonb_build_object('abandonedReason', $2),
        ended_at = COALESCE(ended_at, NOW())
      WHERE room_id = $1 AND status = 'active'
    `,
    [roomId, reason]
  );
}

async function reconcileRoomLifecycleTx(
  client: DbExecutor,
  roomId: string,
  reason: 'required_player_left' | 'inactive_timeout' | 'room_empty' | 'stale_match_recovery'
): Promise<RoomDTO | null> {
  const roomResult = await client.query<{
    id: string;
    host_user_id: string;
    game_type: GameType;
  }>(
    `
      SELECT id, host_user_id, game_type
      FROM rooms
      WHERE id = $1
      FOR UPDATE
    `,
    [roomId]
  );

  const room = roomResult.rows[0];
  if (!room) {
    return null;
  }

  const members = await client.query<{
    user_id: string;
    role: 'player' | 'spectator';
    seat: number | null;
    joined_at: Date | string;
  }>(
    `
      SELECT user_id, role, seat, joined_at
      FROM room_players
      WHERE room_id = $1 AND left_at IS NULL
      ORDER BY CASE WHEN seat IS NULL THEN 999 ELSE seat END ASC, joined_at ASC
    `,
    [roomId]
  );

  if (members.rows.length === 0) {
    await abandonActiveMatches(client, roomId, 'room_empty');
    await client.query(`UPDATE rooms SET status = 'closed' WHERE id = $1`, [roomId]);
    return null;
  }

  const activePlayers = members.rows.filter((row) => row.role === 'player');
  const memberIds = new Set(members.rows.map((row) => row.user_id));
  const requiredPlayers = playerSlotsForGame(room.game_type);

  if (!memberIds.has(room.host_user_id)) {
    const nextHost = activePlayers[0]?.user_id ?? members.rows[0].user_id;
    await client.query(`UPDATE rooms SET host_user_id = $1 WHERE id = $2`, [nextHost, roomId]);
  }

  if (activePlayers.length < requiredPlayers) {
    await abandonActiveMatches(client, roomId, reason);
    await client.query(`UPDATE rooms SET status = 'open' WHERE id = $1`, [roomId]);
  }

  return fetchRoomById(client, roomId);
}

async function loadMovesForMatches(
  client: DbExecutor,
  matchIds: string[]
): Promise<Map<string, MatchMoveDTO[]>> {
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
          is_admin: boolean;
          created_at: Date | string;
        }>(
          `
            INSERT INTO users (display_name, is_guest)
            VALUES ($1, TRUE)
            RETURNING id, display_name, is_guest, is_admin, created_at
          `,
          [displayName]
        );

        const row = created.rows[0];
        await ensureAllRatings(client, row.id);
        const ratings = (await fetchRatingsByUserId(client, [row.id])).get(row.id) ?? createDefaultRatings();
        return mapUser(row, ratings);
      });
    },

    async createRegisteredUser(params): Promise<UserDTO> {
      return withTransaction(async (client) => {
        const created = await client.query<{
          id: string;
          display_name: string;
          is_guest: boolean;
          is_admin: boolean;
          created_at: Date | string;
        }>(
          `
            INSERT INTO users (display_name, email, password_hash, is_guest)
            VALUES ($1, $2, $3, FALSE)
            RETURNING id, display_name, is_guest, is_admin, created_at
          `,
          [params.displayName, params.email.toLowerCase(), params.passwordHash]
        );

        const row = created.rows[0];
        await ensureAllRatings(client, row.id);
        const ratings = (await fetchRatingsByUserId(client, [row.id])).get(row.id) ?? createDefaultRatings();
        return mapUser(row, ratings);
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

    async upgradeGuestUser(params): Promise<UserDTO> {
      return withTransaction(async (client) => {
        const result = await client.query<{
          id: string;
          display_name: string;
          is_guest: boolean;
          is_admin: boolean;
          created_at: Date | string;
        }>(
          `
            UPDATE users
            SET display_name = $2, email = $3, password_hash = $4, is_guest = FALSE
            WHERE id = $1 AND is_guest = TRUE
            RETURNING id, display_name, is_guest, is_admin, created_at
          `,
          [params.userId, params.displayName, params.email.toLowerCase(), params.passwordHash]
        );

        const row = result.rows[0];
        if (!row) {
          throw new StoreError('Guest account not found or already upgraded', 'conflict');
        }

        await ensureAllRatings(client, row.id);
        const ratings = (await fetchRatingsByUserId(client, [row.id])).get(row.id) ?? createDefaultRatings();
        return mapUser(row, ratings);
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
        is_admin: boolean;
        created_at: Date | string;
      }>(
        `
          SELECT id, display_name, password_hash, is_guest, is_admin, created_at
          FROM users
          WHERE email = $1
          LIMIT 1
        `,
        [email.toLowerCase()]
      );

      const row = result.rows[0];
      if (!row || !row.password_hash) {
        return null;
      }

      const ratings = (await fetchRatingsByUserId(pool, [row.id])).get(row.id) ?? createDefaultRatings();

      return {
        user: mapUser(row, ratings),
        passwordHash: row.password_hash
      };
    },

    async getUserById(userId: string): Promise<UserDTO | null> {
      const result = await pool.query<{
        id: string;
        display_name: string;
        is_guest: boolean;
        is_admin: boolean;
        created_at: Date | string;
      }>(
        `
          SELECT id, display_name, is_guest, is_admin, created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [userId]
      );

      const row = result.rows[0];
      if (!row) {
        return null;
      }

      const ratings = (await fetchRatingsByUserId(pool, [row.id])).get(row.id) ?? createDefaultRatings();
      return mapUser(row, ratings);
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

    async listRatingFormulas(): Promise<RatingFormulaDTO[]> {
      return getRatingFormula();
    },

    async listOpenRooms(): Promise<RoomDTO[]> {
      const rooms = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM rooms
          WHERE status <> 'closed'
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

    async createRoom(hostUserId: string, gameType: GameType, maxPlayers?: number): Promise<RoomDTO> {
      return withTransaction(async (client) => {
        const normalizedMaxPlayers = normalizeMaxPlayers(gameType, maxPlayers);

        const roomResult = await client.query<{ id: string }>(
          `
            INSERT INTO rooms (host_user_id, game_type, status, max_players)
            VALUES ($1, $2, 'open', $3)
            RETURNING id
          `,
          [hostUserId, gameType, normalizedMaxPlayers]
        );

        const roomId = roomResult.rows[0].id;
        await client.query(
          `
            INSERT INTO room_players (room_id, user_id, role, seat)
            VALUES ($1, $2, 'player', 1)
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

    async joinRoom(roomId: string, userId: string, asSpectator = false): Promise<RoomDTO> {
      return withTransaction(async (client) => {
        const roomResult = await client.query<{
          id: string;
          game_type: GameType;
          status: 'open' | 'in_match' | 'closed';
          max_players: number;
        }>(
          `
            SELECT id, game_type, status, max_players
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

        if (room.status === 'closed') {
          throw new StoreError('Room is closed', 'forbidden');
        }

        const existing = await client.query<{
          id: string;
        }>(
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

        const activeMembers = await client.query<{
          role: 'player' | 'spectator';
          seat: number | null;
        }>(
          `
            SELECT role, seat
            FROM room_players
            WHERE room_id = $1 AND left_at IS NULL
          `,
          [roomId]
        );

        if (activeMembers.rows.length >= room.max_players) {
          throw new StoreError('Room capacity reached', 'capacity_reached');
        }

        const maxPlayersForMode = playerSlotsForGame(room.game_type);
        const activePlayers = activeMembers.rows.filter((member) => member.role === 'player');

        let role: 'player' | 'spectator' = 'spectator';
        let seat: number | null = null;

        if (!asSpectator && activePlayers.length < maxPlayersForMode) {
          role = 'player';
          const usedSeats = new Set(
            activePlayers.map((member) => member.seat).filter((value): value is number => value !== null)
          );
          let nextSeat = 1;
          while (usedSeats.has(nextSeat) && nextSeat <= maxPlayersForMode) {
            nextSeat += 1;
          }
          seat = nextSeat;
        }

        await client.query(
          `
            INSERT INTO room_players (room_id, user_id, role, seat)
            VALUES ($1, $2, $3, $4)
          `,
          [roomId, userId, role, seat]
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
        const roomResult = await client.query<{ id: string }>(
          `
            SELECT id
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
        return reconcileRoomLifecycleTx(client, roomId, 'required_player_left');
      });
    },

    async createInvitation(params): Promise<InvitationDTO> {
      if (params.fromUserId === params.toUserId) {
        throw new StoreError('Cannot invite yourself', 'validation_error');
      }

      return withTransaction(async (client) => {
        const roomResult = await client.query<{ id: string }>('SELECT id FROM rooms WHERE id = $1', [
          params.roomId
        ]);
        if (roomResult.rows.length === 0) {
          throw new StoreError('Room not found', 'not_found');
        }

        const inviterInRoom = await client.query<{ id: string }>(
          `
            SELECT id
            FROM room_players
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
            LIMIT 1
          `,
          [params.roomId, params.fromUserId]
        );

        if (!inviterInRoom.rows[0]) {
          throw new StoreError('Only room participants can invite users', 'forbidden');
        }

        const targetUser = await client.query<{ id: string }>('SELECT id FROM users WHERE id = $1', [
          params.toUserId
        ]);
        if (targetUser.rows.length === 0) {
          throw new StoreError('Invite target user not found', 'not_found');
        }

        const blocked = await client.query<{ id: string }>(
          `
            SELECT id
            FROM user_blocks
            WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
              OR (blocker_user_id = $2 AND blocked_user_id = $1)
            LIMIT 1
          `,
          [params.fromUserId, params.toUserId]
        );

        if (blocked.rows[0]) {
          throw new StoreError('Invite blocked due to moderation settings', 'forbidden');
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
        result_payload: Record<string, unknown> | null;
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
            m.result_payload,
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
      const movesByMatch = await loadMovesForMatches(
        pool,
        matches.map((match) => match.id)
      );

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
        result_payload: Record<string, unknown> | null;
        started_at: Date | string;
        ended_at: Date | string | null;
      }>(
        `
          SELECT id, room_id, game_type, status, winner_user_id, result_payload, started_at, ended_at
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
    },

    async listRatingsForUser(userId: string): Promise<RatingDTO[]> {
      const result = await pool.query<{
        game_type: GameType;
        rating: number;
        updated_at: Date | string;
      }>(
        `
          SELECT game_type, rating, updated_at
          FROM ratings
          WHERE user_id = $1
          ORDER BY game_type ASC
        `,
        [userId]
      );

      return result.rows.map(mapRating);
    },

    async listBlockedUsers(userId: string): Promise<BlockDTO[]> {
      const result = await pool.query<{
        id: string;
        blocker_user_id: string;
        blocked_user_id: string;
        reason: string | null;
        created_at: Date | string;
      }>(
        `
          SELECT id, blocker_user_id, blocked_user_id, reason, created_at
          FROM user_blocks
          WHERE blocker_user_id = $1
          ORDER BY created_at DESC
        `,
        [userId]
      );

      return result.rows.map(mapBlock);
    },

    async blockUser(params): Promise<BlockDTO> {
      if (params.blockerUserId === params.blockedUserId) {
        throw new StoreError('Cannot block yourself', 'validation_error');
      }

      const result = await pool.query<{
        id: string;
        blocker_user_id: string;
        blocked_user_id: string;
        reason: string | null;
        created_at: Date | string;
      }>(
        `
          INSERT INTO user_blocks (blocker_user_id, blocked_user_id, reason)
          VALUES ($1, $2, $3)
          ON CONFLICT (blocker_user_id, blocked_user_id)
          DO UPDATE SET reason = COALESCE(EXCLUDED.reason, user_blocks.reason)
          RETURNING id, blocker_user_id, blocked_user_id, reason, created_at
        `,
        [params.blockerUserId, params.blockedUserId, params.reason ?? null]
      );

      return mapBlock(result.rows[0]);
    },

    async reportUser(params): Promise<void> {
      if (!params.targetUserId && !params.matchId) {
        throw new StoreError('Report requires targetUserId or matchId', 'validation_error');
      }

      await pool.query(
        `
          INSERT INTO user_reports (reporter_user_id, target_user_id, match_id, reason, details)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          params.reporterUserId,
          params.targetUserId ?? null,
          params.matchId ?? null,
          params.reason,
          params.details ?? null
        ]
      );
    },

    async listReports(params): Promise<ReportDTO[]> {
      const clauses: string[] = [];
      const values: unknown[] = [];

      if (params.status) {
        values.push(params.status);
        clauses.push(`status = $${values.length}`);
      }

      values.push(params.limit);

      const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
      const result = await pool.query<{
        id: string;
        reporter_user_id: string;
        target_user_id: string | null;
        match_id: string | null;
        reason: string;
        details: string | null;
        status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `
          SELECT
            id,
            reporter_user_id,
            target_user_id,
            match_id,
            reason,
            details,
            status,
            created_at,
            updated_at
          FROM user_reports
          ${where}
          ORDER BY created_at DESC
          LIMIT $${values.length}
        `,
        values
      );

      return result.rows.map(mapReport);
    },

    async resolveReport(params): Promise<ReportDTO> {
      const result = await pool.query<{
        id: string;
        reporter_user_id: string;
        target_user_id: string | null;
        match_id: string | null;
        reason: string;
        details: string | null;
        status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
        created_at: Date | string;
        updated_at: Date | string;
      }>(
        `
          UPDATE user_reports
          SET status = $2, updated_at = NOW()
          WHERE id = $1
          RETURNING
            id,
            reporter_user_id,
            target_user_id,
            match_id,
            reason,
            details,
            status,
            created_at,
            updated_at
        `,
        [params.reportId, params.status]
      );

      const row = result.rows[0];
      if (!row) {
        throw new StoreError('Report not found', 'not_found');
      }

      return mapReport(row);
    }
  };
}
