import {
  applyGoMove,
  applyGomokuMove,
  applyXiangqiMove,
  createGoState,
  createGomokuState,
  createXiangqiState
} from '@multiwebgame/game-engines';
import type {
  BoardGameType,
  ClientToServerMessage,
  GoMove,
  GoState,
  GomokuMark,
  GomokuState,
  RoomDTO,
  RoomPlayerRole,
  ServerToClientMessage,
  UserDTO,
  XiangqiColor,
  XiangqiMove,
  XiangqiState
} from '@multiwebgame/shared-types';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';

import { config } from './config.js';
import { MatchmakingQueue } from './matchmaking.js';
import {
  close,
  completeMatch,
  createMatchForRoom,
  createMatchMove,
  createMatchmakingRoom,
  getLatestMatchForRoom,
  getRoom,
  getUserFromSession,
  joinRoomIfPossible,
  listPendingInvitationsForUser,
  respondToInvitation
} from './repository.js';

interface ClientContext {
  socket: WebSocket;
  connectionId: string;
  reconnectKey: string;
  user: UserDTO | null;
  sessionId: string | null;
  subscribedRooms: Set<string>;
  lobbySubscribed: boolean;
  lastSeenAt: number;
}

interface ReconnectSnapshot {
  userId: string;
  lobbySubscribed: boolean;
  roomIds: string[];
  expiresAt: number;
}

interface GomokuRuntime {
  gameType: 'gomoku';
  roomId: string;
  matchId: string;
  state: GomokuState;
  players: {
    black: string;
    white: string;
  };
}

interface GoRuntime {
  gameType: 'go';
  roomId: string;
  matchId: string;
  state: GoState;
  players: {
    black: string;
    white: string;
  };
}

interface XiangqiRuntime {
  gameType: 'xiangqi';
  roomId: string;
  matchId: string;
  state: XiangqiState;
  players: {
    red: string;
    black: string;
  };
}

type ActiveRuntime = GomokuRuntime | GoRuntime | XiangqiRuntime;

const authSchema = z.object({
  type: z.literal('auth'),
  payload: z.object({
    token: z.string().min(10),
    reconnectKey: z.string().optional()
  })
});

const roomSubscribeSchema = z.object({
  type: z.literal('room.subscribe'),
  payload: z.object({
    roomId: z.string().uuid(),
    asSpectator: z.boolean().optional()
  })
});

const roomMoveSchema = z.union([
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('gomoku'),
      x: z.number().int().min(0),
      y: z.number().int().min(0)
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('go'),
      move: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('place'),
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          player: z.enum(['black', 'white'])
        }),
        z.object({
          type: z.literal('pass'),
          player: z.enum(['black', 'white'])
        })
      ])
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('xiangqi'),
      move: z.object({
        from: z.object({ x: z.number().int().min(0).max(8), y: z.number().int().min(0).max(9) }),
        to: z.object({ x: z.number().int().min(0).max(8), y: z.number().int().min(0).max(9) }),
        player: z.enum(['red', 'black'])
      })
    })
  })
]);

const inviteRespondSchema = z.object({
  type: z.literal('invite.respond'),
  payload: z.object({
    invitationId: z.string().uuid(),
    action: z.enum(['accept', 'decline'])
  })
});

const matchmakingJoinSchema = z.object({
  type: z.literal('matchmaking.join'),
  payload: z.object({ gameType: z.enum(['gomoku', 'go', 'xiangqi']) })
});

const pingSchema = z.object({
  type: z.literal('ping'),
  payload: z.object({ ts: z.number().int() })
});

const wss = new WebSocketServer({
  port: config.realtimePort
});

const redis = new Redis(config.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

const clients = new Set<ClientContext>();
const clientsByUserId = new Map<string, Set<ClientContext>>();
const roomSubscribers = new Map<string, Set<ClientContext>>();
const reconnectSnapshots = new Map<string, ReconnectSnapshot>();
const inviteSeenByUser = new Map<string, Set<string>>();
const matchmakingQueue = new MatchmakingQueue({ timeoutMs: 45_000, reconnectGraceMs: 60_000 });
const activeRuntimes = new Map<string, ActiveRuntime>();

function playerSlotsForGame(gameType: BoardGameType): number {
  return gameType === 'gomoku' || gameType === 'go' || gameType === 'xiangqi' ? 2 : 2;
}

function send(client: ClientContext, message: ServerToClientMessage): void {
  if (client.socket.readyState === WebSocket.OPEN) {
    client.socket.send(JSON.stringify(message));
  }
}

function sendError(client: ClientContext, reason: string): void {
  send(client, { type: 'error', payload: { reason } });
}

function broadcast(targets: Iterable<ClientContext>, message: ServerToClientMessage): void {
  for (const client of targets) {
    send(client, message);
  }
}

function getUserClients(userId: string): Set<ClientContext> {
  return clientsByUserId.get(userId) ?? new Set();
}

function sendToUser(userId: string, message: ServerToClientMessage): void {
  broadcast(getUserClients(userId), message);
}

function getOnlineUsers(): Array<{ userId: string; displayName: string }> {
  const result: Array<{ userId: string; displayName: string }> = [];
  for (const [userId, userClients] of clientsByUserId) {
    const client = Array.from(userClients)[0];
    if (client?.user) {
      result.push({ userId, displayName: client.user.displayName });
    }
  }
  return result;
}

function lobbyClients(): ClientContext[] {
  return Array.from(clients).filter((client) => client.user && client.lobbySubscribed);
}

function broadcastLobbyPresence(): void {
  const message: ServerToClientMessage = {
    type: 'lobby.presence',
    payload: {
      onlineUsers: getOnlineUsers()
    }
  };
  broadcast(lobbyClients(), message);
}

function attachUser(client: ClientContext, user: UserDTO, sessionId: string): void {
  if (client.user?.id) {
    const prevSet = clientsByUserId.get(client.user.id);
    prevSet?.delete(client);
    if (prevSet && prevSet.size === 0) {
      clientsByUserId.delete(client.user.id);
    }
  }

  client.user = user;
  client.sessionId = sessionId;

  const userSet = clientsByUserId.get(user.id) ?? new Set<ClientContext>();
  userSet.add(client);
  clientsByUserId.set(user.id, userSet);
}

function detachUser(client: ClientContext): void {
  if (!client.user) {
    return;
  }

  const userId = client.user.id;
  const userSet = clientsByUserId.get(userId);
  userSet?.delete(client);
  if (userSet && userSet.size === 0) {
    clientsByUserId.delete(userId);
  }

  if (userSet && userSet.size > 0) {
    return;
  }

  broadcastLobbyPresence();
}

function addRoomSubscription(client: ClientContext, roomId: string): void {
  client.subscribedRooms.add(roomId);
  const set = roomSubscribers.get(roomId) ?? new Set<ClientContext>();
  set.add(client);
  roomSubscribers.set(roomId, set);
}

function removeRoomSubscription(client: ClientContext, roomId: string): void {
  client.subscribedRooms.delete(roomId);
  const set = roomSubscribers.get(roomId);
  set?.delete(client);
  if (set && set.size === 0) {
    roomSubscribers.delete(roomId);
  }
}

function isUserSubscribedToRoom(userId: string, roomId: string): boolean {
  const set = roomSubscribers.get(roomId);
  if (!set) {
    return false;
  }

  return Array.from(set).some((client) => client.user?.id === userId);
}

function findSeatedPlayers(room: RoomDTO): { first: string | null; second: string | null } {
  const players = room.players
    .filter((player) => player.role === 'player' && player.seat !== null)
    .sort((a, b) => (a.seat ?? 99) - (b.seat ?? 99));

  return {
    first: players[0]?.userId ?? null,
    second: players[1]?.userId ?? null
  };
}

function getViewerRole(room: RoomDTO, userId: string): RoomPlayerRole {
  const member = room.players.find((player) => player.userId === userId);
  return member?.role ?? 'spectator';
}

function createRuntime(room: RoomDTO, matchId: string): ActiveRuntime | null {
  const players = findSeatedPlayers(room);
  if (!players.first || !players.second) {
    return null;
  }

  if (room.gameType === 'gomoku') {
    return {
      gameType: 'gomoku',
      roomId: room.id,
      matchId,
      state: createGomokuState(15),
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'go') {
    return {
      gameType: 'go',
      roomId: room.id,
      matchId,
      state: createGoState(9),
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'xiangqi') {
    return {
      gameType: 'xiangqi',
      roomId: room.id,
      matchId,
      state: createXiangqiState(),
      players: {
        red: players.first,
        black: players.second
      }
    };
  }

  return null;
}

function replayMoves(
  runtime: ActiveRuntime,
  moves: Array<{ payload: Record<string, unknown> }>
): ActiveRuntime {
  let current = runtime;

  for (const move of moves) {
    if (current.gameType === 'gomoku') {
      const payload = move.payload as { x?: number; y?: number; player?: GomokuMark };
      if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
        continue;
      }

      const player = payload.player ?? current.state.nextPlayer;
      const applied = applyGomokuMove(current.state, {
        x: payload.x,
        y: payload.y,
        player
      });

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'go') {
      const payload = move.payload as GoMove;
      if (!payload || typeof payload !== 'object' || !('type' in payload)) {
        continue;
      }

      const applied = applyGoMove(current.state, payload);
      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    const payload = move.payload as unknown as Partial<XiangqiMove>;
    if (!payload?.from || !payload?.to || !payload?.player) {
      continue;
    }

    const applied = applyXiangqiMove(current.state, payload as XiangqiMove);
    current = {
      ...current,
      state: applied.nextState
    };
  }

  return current;
}

async function getOrLoadRuntime(roomId: string): Promise<ActiveRuntime | null> {
  const existing = activeRuntimes.get(roomId);
  if (existing) {
    return existing;
  }

  const match = await getLatestMatchForRoom(roomId);
  if (!match || match.gameType === 'single_2048') {
    return null;
  }

  const room = await getRoom(roomId);
  if (!room) {
    return null;
  }

  const base = createRuntime(room, match.id);
  if (!base) {
    return null;
  }

  const replayed = replayMoves(base, match.moves);

  if (match.status === 'active') {
    activeRuntimes.set(roomId, replayed);
  }

  return replayed;
}

async function ensureRoomMatchIfReady(roomId: string): Promise<ActiveRuntime | null> {
  const existing = await getOrLoadRuntime(roomId);
  if (existing) {
    return existing;
  }

  const room = await getRoom(roomId);
  if (!room || room.gameType === 'single_2048') {
    return null;
  }

  const players = room.players.filter((player) => player.role === 'player');
  if (players.length < playerSlotsForGame(room.gameType)) {
    return null;
  }

  const matchId = await createMatchForRoom(room.id);
  const runtime = createRuntime(room, matchId);
  if (!runtime) {
    return null;
  }

  activeRuntimes.set(room.id, runtime);
  return runtime;
}

async function sendRoomState(client: ClientContext, roomId: string): Promise<void> {
  if (!client.user) {
    return;
  }

  const room = await getRoom(roomId);
  if (!room) {
    sendError(client, 'room_not_found');
    return;
  }

  const runtime = await getOrLoadRuntime(roomId);
  const viewerRole = getViewerRole(room, client.user.id);

  if (room.gameType === 'gomoku') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'gomoku',
        state: runtime?.gameType === 'gomoku' ? runtime.state : createGomokuState(15),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'go') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'go',
        state: runtime?.gameType === 'go' ? runtime.state : createGoState(9),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'xiangqi') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'xiangqi',
        state: runtime?.gameType === 'xiangqi' ? runtime.state : createXiangqiState(),
        viewerRole
      }
    });
    return;
  }

  send(client, {
    type: 'room.state',
    payload: {
      room,
      gameType: 'single_2048',
      state: null,
      viewerRole
    }
  });
}

async function tryMatchmakingPair(gameType: BoardGameType): Promise<void> {
  const pair = matchmakingQueue.popPair(gameType);
  if (!pair) {
    return;
  }

  const [first, second] = pair;

  const paired = await createMatchmakingRoom(first.userId, second.userId, gameType);
  const runtime = createRuntime(paired.room, paired.matchId);
  if (runtime) {
    activeRuntimes.set(paired.room.id, runtime);
  }

  sendToUser(first.userId, {
    type: 'matchmaking.matched',
    payload: {
      room: paired.room,
      matchId: paired.matchId
    }
  });

  sendToUser(second.userId, {
    type: 'matchmaking.matched',
    payload: {
      room: paired.room,
      matchId: paired.matchId
    }
  });

  for (const userId of [first.userId, second.userId]) {
    for (const client of getUserClients(userId)) {
      addRoomSubscription(client, paired.room.id);
      await sendRoomState(client, paired.room.id);
    }
  }
}

async function handleGomokuMove(
  client: ClientContext,
  runtime: GomokuRuntime,
  x: number,
  y: number
): Promise<void> {
  const userId = client.user!.id;
  const playerMark: GomokuMark | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!playerMark) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const applied = applyGomokuMove(runtime.state, {
    x,
    y,
    player: playerMark
  });

  if (!applied.accepted) {
    sendError(client, applied.reason ?? 'invalid_move');
    return;
  }

  runtime.state = applied.nextState;
  activeRuntimes.set(runtime.roomId, runtime);

  await createMatchMove({
    matchId: runtime.matchId,
    actorUserId: userId,
    moveIndex: runtime.state.moveCount,
    moveType: 'gomoku.place_stone',
    payload: {
      x,
      y,
      player: playerMark
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'gomoku',
      state: runtime.state,
      lastMove: {
        x,
        y,
        player: playerMark
      }
    }
  });

  if (runtime.state.status === 'completed' || runtime.state.status === 'draw') {
    const winnerUserId =
      runtime.state.winner === 'black'
        ? runtime.players.black
        : runtime.state.winner === 'white'
          ? runtime.players.white
          : null;

    await completeMatch({
      matchId: runtime.matchId,
      roomId: runtime.roomId,
      winnerUserId,
      status: 'completed'
    });

    activeRuntimes.delete(runtime.roomId);
    broadcast(targets, {
      type: 'match.completed',
      payload: {
        roomId: runtime.roomId,
        matchId: runtime.matchId,
        winnerUserId
      }
    });
  }
}

async function handleGoMove(client: ClientContext, runtime: GoRuntime, move: GoMove): Promise<void> {
  const userId = client.user!.id;
  const playerStone =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!playerStone) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove: GoMove =
    move.type === 'pass'
      ? {
          type: 'pass',
          player: playerStone
        }
      : {
          type: 'place',
          x: move.x,
          y: move.y,
          player: playerStone
        };

  const applied = applyGoMove(runtime.state, normalizedMove);
  if (!applied.accepted) {
    sendError(client, applied.reason ?? 'invalid_move');
    return;
  }

  runtime.state = applied.nextState;
  activeRuntimes.set(runtime.roomId, runtime);

  await createMatchMove({
    matchId: runtime.matchId,
    actorUserId: userId,
    moveIndex: runtime.state.moveCount,
    moveType: normalizedMove.type === 'pass' ? 'go.pass' : 'go.place_stone',
    payload: normalizedMove as unknown as Record<string, unknown>
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'go',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  if (runtime.state.status === 'completed') {
    await completeMatch({
      matchId: runtime.matchId,
      roomId: runtime.roomId,
      winnerUserId: null,
      status: 'completed'
    });

    activeRuntimes.delete(runtime.roomId);
    broadcast(targets, {
      type: 'match.completed',
      payload: {
        roomId: runtime.roomId,
        matchId: runtime.matchId,
        winnerUserId: null
      }
    });
  }
}

async function handleXiangqiMove(
  client: ClientContext,
  runtime: XiangqiRuntime,
  move: XiangqiMove
): Promise<void> {
  const userId = client.user!.id;
  const playerColor: XiangqiColor | null =
    runtime.players.red === userId ? 'red' : runtime.players.black === userId ? 'black' : null;

  if (!playerColor) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove: XiangqiMove = {
    from: move.from,
    to: move.to,
    player: playerColor
  };

  const applied = applyXiangqiMove(runtime.state, normalizedMove);
  if (!applied.accepted) {
    sendError(client, applied.reason ?? 'invalid_move');
    return;
  }

  runtime.state = applied.nextState;
  activeRuntimes.set(runtime.roomId, runtime);

  await createMatchMove({
    matchId: runtime.matchId,
    actorUserId: userId,
    moveIndex: runtime.state.moveCount,
    moveType: 'xiangqi.move_piece',
    payload: normalizedMove as unknown as Record<string, unknown>
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'xiangqi',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  if (runtime.state.status === 'completed') {
    const winnerUserId = runtime.state.winner === 'red' ? runtime.players.red : runtime.players.black;

    await completeMatch({
      matchId: runtime.matchId,
      roomId: runtime.roomId,
      winnerUserId,
      status: 'completed'
    });

    activeRuntimes.delete(runtime.roomId);
    broadcast(targets, {
      type: 'match.completed',
      payload: {
        roomId: runtime.roomId,
        matchId: runtime.matchId,
        winnerUserId
      }
    });
  }
}

async function handleMove(
  client: ClientContext,
  message:
    | { roomId: string; gameType: 'gomoku'; x: number; y: number }
    | { roomId: string; gameType: 'go'; move: GoMove }
    | { roomId: string; gameType: 'xiangqi'; move: XiangqiMove }
): Promise<void> {
  if (!client.user) {
    sendError(client, 'not_authenticated');
    return;
  }

  const runtime = await getOrLoadRuntime(message.roomId);
  if (!runtime) {
    sendError(client, 'no_active_match');
    return;
  }

  if (runtime.gameType !== message.gameType) {
    sendError(client, 'game_type_mismatch');
    return;
  }

  if (message.gameType === 'gomoku' && runtime.gameType === 'gomoku') {
    await handleGomokuMove(client, runtime, message.x, message.y);
    return;
  }

  if (message.gameType === 'go' && runtime.gameType === 'go') {
    await handleGoMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'xiangqi' && runtime.gameType === 'xiangqi') {
    await handleXiangqiMove(client, runtime, message.move);
    return;
  }

  sendError(client, 'game_type_mismatch');
}

async function handleInvitePoll(): Promise<void> {
  const users = Array.from(clientsByUserId.keys());

  for (const userId of users) {
    const pending = await listPendingInvitationsForUser(userId);
    const seen = inviteSeenByUser.get(userId) ?? new Set<string>();

    for (const invitation of pending) {
      if (seen.has(invitation.id)) {
        continue;
      }

      sendToUser(userId, {
        type: 'invite.received',
        payload: {
          invitation
        }
      });
      seen.add(invitation.id);
    }

    inviteSeenByUser.set(userId, seen);
  }
}

function parseMessage(raw: string): ClientToServerMessage | null {
  try {
    return JSON.parse(raw) as ClientToServerMessage;
  } catch {
    return null;
  }
}

wss.on('connection', (socket) => {
  const client: ClientContext = {
    socket,
    connectionId: randomUUID(),
    reconnectKey: randomUUID(),
    user: null,
    sessionId: null,
    subscribedRooms: new Set(),
    lobbySubscribed: false,
    lastSeenAt: Date.now()
  };

  clients.add(client);

  socket.on('message', async (buffer) => {
    client.lastSeenAt = Date.now();

    const parsed = parseMessage(buffer.toString());
    if (!parsed) {
      sendError(client, 'invalid_json');
      return;
    }

    try {
      if (parsed.type === 'auth') {
        const msg = authSchema.parse(parsed);
        const payload = jwt.verify(msg.payload.token, config.jwtSecret) as {
          sessionId?: string;
          userId?: string;
        };
        if (!payload.sessionId || !payload.userId) {
          send(client, { type: 'auth.error', payload: { reason: 'invalid_token_payload' } });
          return;
        }

        const user = await getUserFromSession(payload.sessionId, payload.userId);
        if (!user) {
          send(client, { type: 'auth.error', payload: { reason: 'invalid_or_expired_session' } });
          return;
        }

        attachUser(client, user, payload.sessionId);

        if (msg.payload.reconnectKey) {
          const snapshot = reconnectSnapshots.get(msg.payload.reconnectKey);
          if (snapshot && snapshot.userId === user.id && snapshot.expiresAt > Date.now()) {
            client.reconnectKey = msg.payload.reconnectKey;
            client.lobbySubscribed = snapshot.lobbySubscribed;
            reconnectSnapshots.delete(msg.payload.reconnectKey);

            for (const roomId of snapshot.roomIds) {
              addRoomSubscription(client, roomId);
              await sendRoomState(client, roomId);
            }
          }
        }

        matchmakingQueue.markReconnected(user.id);
        const queueEntry = matchmakingQueue.getEntry(user.id);

        send(client, {
          type: 'auth.ok',
          payload: {
            connectionId: client.connectionId,
            reconnectKey: client.reconnectKey,
            user
          }
        });

        if (queueEntry) {
          send(client, {
            type: 'matchmaking.queued',
            payload: {
              gameType: queueEntry.gameType,
              queueSize: matchmakingQueue.getQueueSize(queueEntry.gameType)
            }
          });
        }

        broadcastLobbyPresence();
        return;
      }

      if (!client.user) {
        sendError(client, 'authenticate_first');
        return;
      }
      const authedUser = client.user;

      if (parsed.type === 'lobby.subscribe') {
        client.lobbySubscribed = true;
        broadcastLobbyPresence();
        return;
      }

      if (parsed.type === 'room.subscribe') {
        const msg = roomSubscribeSchema.parse(parsed);
        const room = await getRoom(msg.payload.roomId);
        if (!room) {
          sendError(client, 'room_not_found');
          return;
        }

        const isMember = room.players.some((player) => player.userId === authedUser.id);
        if (!isMember && !msg.payload.asSpectator) {
          sendError(client, 'room_access_denied');
          return;
        }

        if (!isUserSubscribedToRoom(authedUser.id, msg.payload.roomId)) {
          const role = getViewerRole(room, authedUser.id);
          broadcast(roomSubscribers.get(msg.payload.roomId) ?? [], {
            type: 'room.player_joined',
            payload: {
              roomId: msg.payload.roomId,
              user: authedUser,
              role
            }
          });
        }

        addRoomSubscription(client, msg.payload.roomId);

        if (!isMember && msg.payload.asSpectator) {
          await joinRoomIfPossible(msg.payload.roomId, authedUser.id, true);
        }

        await ensureRoomMatchIfReady(msg.payload.roomId);
        await sendRoomState(client, msg.payload.roomId);
        return;
      }

      if (parsed.type === 'room.move') {
        const msg = roomMoveSchema.parse(parsed);

        if (msg.payload.gameType === 'gomoku') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'gomoku',
            x: msg.payload.x,
            y: msg.payload.y
          });
          return;
        }

        if (msg.payload.gameType === 'go') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'go',
            move: msg.payload.move
          });
          return;
        }

        await handleMove(client, {
          roomId: msg.payload.roomId,
          gameType: 'xiangqi',
          move: msg.payload.move
        });
        return;
      }

      if (parsed.type === 'matchmaking.join') {
        const msg = matchmakingJoinSchema.parse(parsed);

        matchmakingQueue.join(authedUser.id, msg.payload.gameType);

        send(client, {
          type: 'matchmaking.queued',
          payload: {
            gameType: msg.payload.gameType,
            queueSize: matchmakingQueue.getQueueSize(msg.payload.gameType)
          }
        });

        await tryMatchmakingPair(msg.payload.gameType);
        return;
      }

      if (parsed.type === 'matchmaking.leave') {
        const removed = matchmakingQueue.leave(authedUser.id);
        if (removed) {
          send(client, {
            type: 'matchmaking.queued',
            payload: {
              gameType: removed.gameType,
              queueSize: matchmakingQueue.getQueueSize(removed.gameType)
            }
          });
        }
        return;
      }

      if (parsed.type === 'invite.respond') {
        const msg = inviteRespondSchema.parse(parsed);
        const invitation = await respondToInvitation({
          invitationId: msg.payload.invitationId,
          userId: authedUser.id,
          action: msg.payload.action
        });

        if (!invitation) {
          sendError(client, 'invitation_not_found');
          return;
        }

        sendToUser(invitation.toUserId, {
          type: 'invite.updated',
          payload: {
            invitationId: invitation.id,
            status: invitation.status
          }
        });

        sendToUser(invitation.fromUserId, {
          type: 'invite.updated',
          payload: {
            invitationId: invitation.id,
            status: invitation.status
          }
        });

        if (invitation.status === 'accepted') {
          const room = await joinRoomIfPossible(invitation.roomId, authedUser.id, false);
          if (room) {
            for (const roomClient of getUserClients(authedUser.id)) {
              addRoomSubscription(roomClient, room.id);
              await sendRoomState(roomClient, room.id);
            }

            await ensureRoomMatchIfReady(room.id);
          }
        }

        return;
      }

      if (parsed.type === 'ping') {
        const msg = pingSchema.parse(parsed);
        send(client, {
          type: 'pong',
          payload: {
            ts: msg.payload.ts
          }
        });
        return;
      }

      sendError(client, 'unsupported_message');
    } catch (error) {
      sendError(client, error instanceof Error ? error.message : 'message_handling_failed');
    }
  });

  socket.on('close', () => {
    if (client.user) {
      matchmakingQueue.markDisconnected(client.user.id);
    }

    for (const roomId of client.subscribedRooms) {
      removeRoomSubscription(client, roomId);
      if (client.user && !isUserSubscribedToRoom(client.user.id, roomId)) {
        broadcast(roomSubscribers.get(roomId) ?? [], {
          type: 'room.player_left',
          payload: {
            roomId,
            userId: client.user.id
          }
        });
      }
    }

    if (client.user) {
      reconnectSnapshots.set(client.reconnectKey, {
        userId: client.user.id,
        lobbySubscribed: client.lobbySubscribed,
        roomIds: Array.from(client.subscribedRooms),
        expiresAt: Date.now() + 60_000
      });
    }

    detachUser(client);
    clients.delete(client);
  });
});

const invitePollInterval = setInterval(() => {
  handleInvitePoll().catch((error) => {
    console.error('Invite poll error', error);
  });
}, 4_000);

const reconnectCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, snapshot] of reconnectSnapshots) {
    if (snapshot.expiresAt <= now) {
      reconnectSnapshots.delete(key);
    }
  }
}, 10_000);

const matchmakingSweepInterval = setInterval(() => {
  const events = matchmakingQueue.sweep();

  for (const event of events) {
    if (event.type === 'timed_out') {
      sendToUser(event.userId, {
        type: 'matchmaking.timeout',
        payload: {
          gameType: event.gameType
        }
      });

      sendToUser(event.userId, {
        type: 'matchmaking.queued',
        payload: {
          gameType: event.gameType,
          queueSize: matchmakingQueue.getQueueSize(event.gameType)
        }
      });
    }
  }
}, 2_000);

const heartbeatSweepInterval = setInterval(() => {
  const now = Date.now();
  for (const client of clients) {
    if (now - client.lastSeenAt > 55_000) {
      client.socket.close(4000, 'heartbeat_timeout');
    }
  }
}, 5_000);

redis
  .connect()
  .then(() => redis.ping())
  .then(() => console.log('Realtime redis connected'))
  .catch((error: unknown) => {
    console.warn(
      'Realtime redis unavailable, continuing without pubsub',
      error instanceof Error ? error.message : 'unknown_error'
    );
  });

console.log(`Realtime WS listening on :${config.realtimePort}`);

const shutdown = async () => {
  clearInterval(invitePollInterval);
  clearInterval(reconnectCleanupInterval);
  clearInterval(matchmakingSweepInterval);
  clearInterval(heartbeatSweepInterval);

  wss.close(async () => {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }

    await close();
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
