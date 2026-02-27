import { applyGomokuMove, createGomokuState } from '@multiwebgame/game-engines';
import type {
  ClientToServerMessage,
  GomokuMark,
  GomokuState,
  ServerToClientMessage,
  UserDTO
} from '@multiwebgame/shared-types';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { z } from 'zod';

import { config } from './config.js';
import {
  close,
  createMatchForRoom,
  completeMatch,
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
}

interface ReconnectSnapshot {
  userId: string;
  lobbySubscribed: boolean;
  roomIds: string[];
  expiresAt: number;
}

interface ActiveGomokuMatch {
  roomId: string;
  matchId: string;
  state: GomokuState;
  players: Record<GomokuMark, string>;
}

const authSchema = z.object({
  type: z.literal('auth'),
  payload: z.object({
    token: z.string().min(10),
    reconnectKey: z.string().optional()
  })
});

const roomSubscribeSchema = z.object({
  type: z.literal('room.subscribe'),
  payload: z.object({ roomId: z.string().uuid() })
});

const roomMoveSchema = z.object({
  type: z.literal('room.move'),
  payload: z.object({
    roomId: z.string().uuid(),
    x: z.number().int().min(0),
    y: z.number().int().min(0)
  })
});

const inviteRespondSchema = z.object({
  type: z.literal('invite.respond'),
  payload: z.object({
    invitationId: z.string().uuid(),
    action: z.enum(['accept', 'decline'])
  })
});

const matchmakingJoinSchema = z.object({
  type: z.literal('matchmaking.join'),
  payload: z.object({ gameType: z.literal('gomoku') })
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
const matchmakingQueue: string[] = [];
const activeGomokuMatches = new Map<string, ActiveGomokuMatch>();

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

function removeFromQueue(userId: string): void {
  let index = matchmakingQueue.indexOf(userId);
  while (index !== -1) {
    matchmakingQueue.splice(index, 1);
    index = matchmakingQueue.indexOf(userId);
  }
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

async function getOrLoadRuntime(roomId: string): Promise<ActiveGomokuMatch | null> {
  const existing = activeGomokuMatches.get(roomId);
  if (existing) {
    return existing;
  }

  const match = await getLatestMatchForRoom(roomId);
  if (!match || match.gameType !== 'gomoku') {
    return null;
  }

  const room = await getRoom(roomId);
  if (!room) {
    return null;
  }

  const black = room.players.find((player) => player.seat === 1)?.userId;
  const white = room.players.find((player) => player.seat === 2)?.userId;
  if (!black || !white) {
    return null;
  }

  let state = createGomokuState(15);
  for (const move of match.moves) {
    const payload = move.payload as { x?: number; y?: number; player?: GomokuMark };
    if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
      continue;
    }

    const player = payload.player ?? state.nextPlayer;
    const applied = applyGomokuMove(state, { x: payload.x, y: payload.y, player });
    state = applied.nextState;
  }

  if (match.status === 'active') {
    const runtime: ActiveGomokuMatch = {
      roomId,
      matchId: match.id,
      state,
      players: { black, white }
    };
    activeGomokuMatches.set(roomId, runtime);
    return runtime;
  }

  return {
    roomId,
    matchId: match.id,
    state,
    players: { black, white }
  };
}

async function sendRoomState(client: ClientContext, roomId: string): Promise<void> {
  const room = await getRoom(roomId);
  if (!room) {
    sendError(client, 'room_not_found');
    return;
  }

  const runtime = await getOrLoadRuntime(roomId);
  send(client, {
    type: 'room.state',
    payload: {
      room,
      gomokuState: room.gameType === 'gomoku' ? runtime?.state ?? createGomokuState(15) : null
    }
  });
}

async function tryMatchmakingPair(): Promise<void> {
  if (matchmakingQueue.length < 2) {
    return;
  }

  const first = matchmakingQueue.shift();
  const second = matchmakingQueue.shift();

  if (!first || !second || first === second) {
    return;
  }

  const paired = await createMatchmakingRoom(first, second);
  const runtime: ActiveGomokuMatch = {
    roomId: paired.room.id,
    matchId: paired.matchId,
    state: createGomokuState(15),
    players: {
      black: first,
      white: second
    }
  };

  activeGomokuMatches.set(paired.room.id, runtime);

  sendToUser(first, {
    type: 'matchmaking.matched',
    payload: {
      room: paired.room,
      matchId: paired.matchId
    }
  });

  sendToUser(second, {
    type: 'matchmaking.matched',
    payload: {
      room: paired.room,
      matchId: paired.matchId
    }
  });

  for (const userId of [first, second]) {
    for (const client of getUserClients(userId)) {
      addRoomSubscription(client, paired.room.id);
      await sendRoomState(client, paired.room.id);
    }
  }
}

async function handleMove(client: ClientContext, roomId: string, x: number, y: number): Promise<void> {
  if (!client.user) {
    sendError(client, 'not_authenticated');
    return;
  }

  const runtime = await getOrLoadRuntime(roomId);
  if (!runtime) {
    sendError(client, 'no_active_match');
    return;
  }

  const playerMark: GomokuMark | null =
    runtime.players.black === client.user.id ? 'black' : runtime.players.white === client.user.id ? 'white' : null;

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
  activeGomokuMatches.set(roomId, runtime);

  await createMatchMove({
    matchId: runtime.matchId,
    actorUserId: client.user.id,
    moveIndex: runtime.state.moveCount,
    moveType: 'place_stone',
    payload: {
      x,
      y,
      player: playerMark
    }
  });

  const targets = roomSubscribers.get(roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId,
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
      roomId,
      winnerUserId,
      status: 'completed'
    });

    activeGomokuMatches.delete(roomId);
  }
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
    lobbySubscribed: false
  };

  clients.add(client);

  socket.on('message', async (buffer) => {
    const parsed = parseMessage(buffer.toString());
    if (!parsed) {
      sendError(client, 'invalid_json');
      return;
    }

    try {
      if (parsed.type === 'auth') {
        const msg = authSchema.parse(parsed);
        const payload = jwt.verify(msg.payload.token, config.jwtSecret) as { sessionId?: string; userId?: string };
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

        send(client, {
          type: 'auth.ok',
          payload: {
            connectionId: client.connectionId,
            reconnectKey: client.reconnectKey,
            user
          }
        });

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
        if (!room.players.some((player) => player.userId === authedUser.id)) {
          sendError(client, 'room_access_denied');
          return;
        }

        if (!isUserSubscribedToRoom(authedUser.id, msg.payload.roomId)) {
          broadcast(roomSubscribers.get(msg.payload.roomId) ?? [], {
            type: 'room.player_joined',
            payload: {
              roomId: msg.payload.roomId,
              user: authedUser
            }
          });
        }

        addRoomSubscription(client, msg.payload.roomId);
        await sendRoomState(client, msg.payload.roomId);
        return;
      }

      if (parsed.type === 'room.move') {
        const msg = roomMoveSchema.parse(parsed);
        await handleMove(client, msg.payload.roomId, msg.payload.x, msg.payload.y);
        return;
      }

      if (parsed.type === 'matchmaking.join') {
        const msg = matchmakingJoinSchema.parse(parsed);
        if (msg.payload.gameType !== 'gomoku') {
          sendError(client, 'unsupported_matchmaking_game');
          return;
        }

        if (!matchmakingQueue.includes(authedUser.id)) {
          matchmakingQueue.push(authedUser.id);
        }

        send(client, {
          type: 'matchmaking.queued',
          payload: {
            queueSize: matchmakingQueue.length
          }
        });

        await tryMatchmakingPair();
        return;
      }

      if (parsed.type === 'matchmaking.leave') {
        removeFromQueue(authedUser.id);
        send(client, {
          type: 'matchmaking.queued',
          payload: {
            queueSize: matchmakingQueue.length
          }
        });
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
          const room = await joinRoomIfPossible(invitation.roomId, authedUser.id);
          if (room) {
            for (const roomClient of getUserClients(authedUser.id)) {
              addRoomSubscription(roomClient, room.id);
              await sendRoomState(roomClient, room.id);
            }

            if (room.players.length === 2 && room.gameType === 'gomoku') {
              await getOrLoadRuntime(room.id);
              if (!activeGomokuMatches.has(room.id)) {
                const black = room.players.find((player) => player.seat === 1)?.userId;
                const white = room.players.find((player) => player.seat === 2)?.userId;
                if (black && white) {
                  const matchId = await createMatchForRoom(room.id);
                  activeGomokuMatches.set(room.id, {
                    roomId: room.id,
                    matchId,
                    state: createGomokuState(15),
                    players: { black, white }
                  });
                }
              }
            }
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
    removeFromQueue(client.user?.id ?? '');

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
