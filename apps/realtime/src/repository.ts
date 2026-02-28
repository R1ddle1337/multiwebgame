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
type RatingMap = Partial<Record<GameType, number>>;

const ALL_GAME_TYPES: GameType[] = ['single_2048', 'gomoku', 'xiangqi', 'go', 'connect4', 'reversi', 'dots'];
const INITIAL_RATING = 1200;
const ELO_K_FACTOR_BY_GAME: Record<GameType, number> = {
  single_2048: 24,
  gomoku: 24,
  xiangqi: 24,
  go: 24,
  connect4: 24,
  reversi: 24,
  dots: 24
};

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

function createDefaultRatings(): RatingMap {
  return {
    single_2048: INITIAL_RATING,
    gomoku: INITIAL_RATING,
    xiangqi: INITIAL_RATING,
    go: INITIAL_RATING,
    connect4: INITIAL_RATING,
    reversi: INITIAL_RATING,
    dots: INITIAL_RATING
  };
}

function playerSlotsForGame(gameType: GameType): number {
  return gameType === 'single_2048' ? 1 : 2;
}

function defaultMaxPlayersForGame(gameType: GameType): number {
  return gameType === 'single_2048' ? 1 : 4;
}

async function abandonActiveMatches(
  client: DbExecutor,
  roomId: string,
  reason: 'required_player_left' | 'inactive_timeout' | 'room_empty' | 'stale_match_recovery'
): Promise<void> {
  const result = await client.query(
    `
      UPDATE matches
      SET
        status = 'abandoned',
        winner_user_id = NULL,
        result_payload = COALESCE(result_payload, '{}'::jsonb) || jsonb_build_object('abandonedReason', $2::text),
        ended_at = COALESCE(ended_at, NOW())
      WHERE room_id = $1 AND status = 'active'
    `,
    [roomId, reason]
  );

  if (result.rowCount) {
    await invalidateInviteLinksByRoom(client, roomId, 'match_ended');
  }
}

async function invalidateInviteLinksByRoom(
  client: DbExecutor,
  roomId: string,
  reason: 'match_ended' | 'room_closed'
): Promise<void> {
  await client.query(
    `
      UPDATE invite_links
      SET invalidated_at = NOW(), invalidated_reason = $2
      WHERE room_id = $1 AND invalidated_at IS NULL
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

  const membersResult = await client.query<{
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

  if (membersResult.rows.length === 0) {
    await abandonActiveMatches(client, roomId, 'room_empty');
    await client.query(`UPDATE rooms SET status = 'closed' WHERE id = $1`, [roomId]);
    await invalidateInviteLinksByRoom(client, roomId, 'room_closed');
    return null;
  }

  const activePlayers = membersResult.rows.filter((row) => row.role === 'player');
  const memberIds = new Set(membersResult.rows.map((row) => row.user_id));
  const requiredPlayers = playerSlotsForGame(room.game_type);

  if (!memberIds.has(room.host_user_id)) {
    const nextHost = activePlayers[0]?.user_id ?? membersResult.rows[0].user_id;
    await client.query(`UPDATE rooms SET host_user_id = $1 WHERE id = $2`, [nextHost, roomId]);
  }

  if (activePlayers.length < requiredPlayers) {
    await abandonActiveMatches(client, roomId, reason);
    await client.query(`UPDATE rooms SET status = 'open' WHERE id = $1`, [roomId]);
  }

  return fetchRoomById(client, roomId);
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

  const ratingsByUser = await fetchRatingsByUserId(
    client,
    players.rows.map((row) => row.user_id)
  );

  const mappedPlayers: RoomPlayerDTO[] = players.rows.map((row) => ({
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    role: row.role,
    seat: row.seat,
    joinedAt: toIso(row.joined_at),
    leftAt: row.left_at ? toIso(row.left_at) : null,
    user: mapUser(row, ratingsByUser.get(row.user_id) ?? createDefaultRatings())
  }));

  return {
    id: room.id,
    hostUserId: room.host_user_id,
    gameType: room.game_type,
    status: room.status,
    maxPlayers: room.max_players,
    createdAt: toIso(room.created_at),
    players: mappedPlayers
  };
}

async function updateRatingsForMatch(
  client: DbExecutor,
  roomId: string,
  gameType: GameType,
  winnerUserId: string | null
): Promise<void> {
  if (gameType === 'single_2048') {
    return;
  }

  const playersResult = await client.query<{ user_id: string }>(
    `
      SELECT user_id
      FROM room_players
      WHERE room_id = $1 AND role = 'player'
      ORDER BY seat ASC
      LIMIT 2
    `,
    [roomId]
  );

  if (playersResult.rows.length < 2) {
    return;
  }

  const [a, b] = playersResult.rows.map((row) => row.user_id);

  await ensureAllRatings(client, a);
  await ensureAllRatings(client, b);

  const current = await client.query<{
    user_id: string;
    rating: number;
  }>(
    `
      SELECT user_id, rating
      FROM ratings
      WHERE game_type = $1 AND user_id = ANY($2::uuid[])
    `,
    [gameType, [a, b]]
  );

  const currentByUser = new Map<string, number>();
  for (const row of current.rows) {
    currentByUser.set(row.user_id, row.rating);
  }

  const ratingA = currentByUser.get(a) ?? INITIAL_RATING;
  const ratingB = currentByUser.get(b) ?? INITIAL_RATING;

  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  let scoreA = 0.5;
  let scoreB = 0.5;
  if (winnerUserId === a) {
    scoreA = 1;
    scoreB = 0;
  } else if (winnerUserId === b) {
    scoreA = 0;
    scoreB = 1;
  }

  const k = ELO_K_FACTOR_BY_GAME[gameType];
  const newA = Math.round(ratingA + k * (scoreA - expectedA));
  const newB = Math.round(ratingB + k * (scoreB - expectedB));

  await client.query(
    `
      UPDATE ratings
      SET rating = $3, updated_at = NOW()
      WHERE user_id = $1 AND game_type = $2
    `,
    [a, gameType, newA]
  );

  await client.query(
    `
      UPDATE ratings
      SET rating = $3, updated_at = NOW()
      WHERE user_id = $1 AND game_type = $2
    `,
    [b, gameType, newB]
  );
}

export async function getUserFromSession(sessionId: string, userId: string): Promise<UserDTO | null> {
  const result = await pool.query<{
    id: string;
    display_name: string;
    is_guest: boolean;
    is_admin: boolean;
    created_at: Date | string;
  }>(
    `
      SELECT u.id, u.display_name, u.is_guest, u.is_admin, u.created_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.user_id = $2 AND s.expires_at > NOW()
      LIMIT 1
    `,
    [sessionId, userId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const ratings = (await fetchRatingsByUserId(pool, [row.id])).get(row.id) ?? createDefaultRatings();
  return mapUser(row, ratings);
}

export async function getRoom(roomId: string): Promise<RoomDTO | null> {
  return fetchRoomById(pool, roomId);
}

export async function createMatchmakingRoom(
  userAId: string,
  userBId: string,
  gameType: Extract<GameType, 'gomoku' | 'xiangqi' | 'go' | 'connect4' | 'reversi' | 'dots'>
): Promise<{ room: RoomDTO; matchId: string }> {
  return withTransaction(async (client) => {
    const roomResult = await client.query<{ id: string }>(
      `
        INSERT INTO rooms (host_user_id, game_type, status, max_players)
        VALUES ($1, $2, 'in_match', $3)
        RETURNING id
      `,
      [userAId, gameType, defaultMaxPlayersForGame(gameType)]
    );

    const roomId = roomResult.rows[0].id;

    await client.query(
      `
        INSERT INTO room_players (room_id, user_id, role, seat)
        VALUES
          ($1, $2, 'player', 1),
          ($1, $3, 'player', 2)
      `,
      [roomId, userAId, userBId]
    );

    const matchResult = await client.query<{ id: string }>(
      `
        INSERT INTO matches (room_id, game_type, status)
        VALUES ($1, $2, 'active')
        RETURNING id
      `,
      [roomId, gameType]
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
    const roomResult = await client.query<{ game_type: GameType; status: 'open' | 'in_match' | 'closed' }>(
      `
        SELECT game_type, status
        FROM rooms
        WHERE id = $1
        FOR UPDATE
      `,
      [roomId]
    );

    const room = roomResult.rows[0];
    if (!room) {
      throw new Error('room_not_found');
    }

    const existingActive = await client.query<{ id: string }>(
      `
        SELECT id
        FROM matches
        WHERE room_id = $1 AND status = 'active'
        ORDER BY started_at DESC
        LIMIT 1
      `,
      [roomId]
    );

    const existingMatch = existingActive.rows[0];
    if (existingMatch) {
      if (room.status !== 'in_match') {
        await client.query(`UPDATE rooms SET status = 'in_match' WHERE id = $1`, [roomId]);
      }
      return existingMatch.id;
    }

    const playersResult = await client.query<{ player_count: number }>(
      `
        SELECT COUNT(*)::int AS player_count
        FROM room_players
        WHERE room_id = $1 AND role = 'player' AND left_at IS NULL
      `,
      [roomId]
    );

    const requiredPlayers = playerSlotsForGame(room.game_type);
    const playerCount = playersResult.rows[0]?.player_count ?? 0;
    if (playerCount < requiredPlayers) {
      throw new Error('not_enough_players');
    }

    await client.query(`UPDATE rooms SET status = 'in_match' WHERE id = $1`, [roomId]);

    const result = await client.query<{ id: string }>(
      `
        INSERT INTO matches (room_id, game_type, status)
        VALUES ($1, $2, 'active')
        RETURNING id
      `,
      [roomId, room.game_type]
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
    result_payload: Record<string, unknown> | null;
    started_at: Date | string;
    ended_at: Date | string | null;
  }>(
    `
      SELECT id, room_id, game_type, status, winner_user_id, result_payload, started_at, ended_at
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
  resultPayload?: Record<string, unknown> | null;
}): Promise<void> {
  await withTransaction(async (client) => {
    const matchResult = await client.query<{
      game_type: GameType;
      status: 'active' | 'completed' | 'abandoned';
      room_id: string;
    }>(
      `
        SELECT game_type, status, room_id
        FROM matches
        WHERE id = $1
        FOR UPDATE
        LIMIT 1
      `,
      [params.matchId]
    );

    const match = matchResult.rows[0];
    if (!match) {
      throw new Error('match_not_found');
    }

    if (match.room_id !== params.roomId) {
      throw new Error('room_match_mismatch');
    }

    if (match.status !== 'active') {
      return;
    }

    const completed = await client.query(
      `
        UPDATE matches
        SET status = $1, winner_user_id = $2, result_payload = $3, ended_at = NOW()
        WHERE id = $4 AND status = 'active'
      `,
      [params.status, params.winnerUserId, params.resultPayload ?? null, params.matchId]
    );

    if (!completed.rowCount) {
      return;
    }

    if (params.status === 'completed') {
      await updateRatingsForMatch(client, params.roomId, match.game_type, params.winnerUserId);
    }

    await invalidateInviteLinksByRoom(client, params.roomId, 'match_ended');

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

export async function joinRoomIfPossible(
  roomId: string,
  userId: string,
  asSpectator = false
): Promise<RoomDTO | null> {
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
    if (!room || room.status === 'closed') {
      return null;
    }

    const existing = await client.query<{ role: 'player' | 'spectator'; seat: number | null }>(
      'SELECT role, seat FROM room_players WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL',
      [roomId, userId]
    );

    const members = await client.query<{ role: 'player' | 'spectator'; seat: number | null }>(
      'SELECT role, seat FROM room_players WHERE room_id = $1 AND left_at IS NULL',
      [roomId]
    );

    const maxPlayerSlots = playerSlotsForGame(room.game_type);
    const activePlayers = members.rows.filter((row) => row.role === 'player');
    if (existing.rowCount && existing.rows[0].role === 'spectator' && !asSpectator) {
      if (activePlayers.length < maxPlayerSlots) {
        const used = new Set(
          activePlayers.map((row) => row.seat).filter((value): value is number => value !== null)
        );
        let seat = 1;
        while (used.has(seat) && seat <= maxPlayerSlots) {
          seat += 1;
        }

        await client.query(
          `
            UPDATE room_players
            SET role = 'player', seat = $3
            WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
          `,
          [roomId, userId, seat]
        );
      }

      return fetchRoomById(client, roomId);
    }

    if (existing.rowCount === 0) {
      if (members.rows.length >= room.max_players) {
        return null;
      }

      let role: 'player' | 'spectator' = 'spectator';
      let seat: number | null = null;

      if (!asSpectator && activePlayers.length < maxPlayerSlots) {
        role = 'player';
        const used = new Set(
          activePlayers.map((row) => row.seat).filter((value): value is number => value !== null)
        );
        seat = 1;
        while (used.has(seat) && seat <= maxPlayerSlots) {
          seat += 1;
        }
      }

      await client.query('INSERT INTO room_players (room_id, user_id, role, seat) VALUES ($1, $2, $3, $4)', [
        roomId,
        userId,
        role,
        seat
      ]);
    }

    return fetchRoomById(client, roomId);
  });
}

export async function leaveRoomIfPresent(
  roomId: string,
  userId: string,
  reason: 'required_player_left' | 'inactive_timeout' = 'required_player_left'
): Promise<RoomDTO | null> {
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

    if (!roomResult.rows[0]) {
      return null;
    }

    await client.query(
      `
        UPDATE room_players
        SET left_at = NOW()
        WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL
      `,
      [roomId, userId]
    );

    return reconcileRoomLifecycleTx(client, roomId, reason);
  });
}

export async function reconcileRoomLifecycle(
  roomId: string,
  reason:
    | 'required_player_left'
    | 'inactive_timeout'
    | 'room_empty'
    | 'stale_match_recovery' = 'stale_match_recovery'
): Promise<RoomDTO | null> {
  return withTransaction((client) => reconcileRoomLifecycleTx(client, roomId, reason));
}

export async function close(): Promise<void> {
  await pool.end();
}
