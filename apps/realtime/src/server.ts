import {
  applyBackgammonMove,
  applyCardsMove,
  applyConnect4Move,
  applyDotsMove,
  applyHexMove,
  applyLiarsDiceMove,
  applyGoMove,
  applyGomokuMove,
  applySantoriniMove,
  applyQuoridorMove,
  applyReversiMove,
  applyXiangqiMove,
  assignBackgammonTurnDice,
  createBackgammonState,
  createCardsDeck,
  createCardsState,
  createConnect4State,
  createDeterministicPrng,
  createDotsState,
  createHexState,
  createLiarsDiceState,
  createGoState,
  createGomokuState,
  createSantoriniState,
  createQuoridorState,
  hasAnyLegalBackgammonMove,
  createReversiState,
  createXiangqiState,
  formatXiangqiMoveNotation,
  normalizeSantoriniMove,
  toCardsPublicState,
  toLiarsDicePublicState,
  type CardsRuntimeState,
  type LiarsDiceRuntimeState,
  type DeterministicPrng
} from '@multiwebgame/game-engines';
import type {
  BackgammonMove,
  BackgammonState,
  BoardGameType,
  CardsCard,
  CardsMove,
  CardsMoveInput,
  CardsPlayer,
  ClientToServerMessage,
  Connect4Move,
  Connect4State,
  DotsMove,
  DotsState,
  HexMove,
  HexState,
  LiarsDiceMove,
  LiarsDiceMoveInput,
  LiarsDicePlayer,
  LiarsDiceState,
  GoMove,
  GoState,
  GomokuMark,
  GomokuState,
  SantoriniMove,
  SantoriniMoveInput,
  SantoriniPlayer,
  SantoriniState,
  ReversiMove,
  ReversiState,
  QuoridorMove,
  QuoridorMoveInput,
  QuoridorState,
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
import { aggregateReconnectState } from './reconnect-state.js';
import {
  close,
  closeIdleRooms,
  completeMatch,
  createMatchForRoom,
  createMatchMove,
  createMatchmakingRoom,
  getLatestMatchForRoom,
  getUserFromSession,
  joinRoomIfPossible,
  leaveRoomIfPresent,
  listPendingInvitationsForUser,
  reconcileRoomLifecycle,
  respondToInvitation,
  touchRoomLastActiveAt
} from './repository.js';
import { deriveRuntimeCompletion } from './runtime-completion.js';
import {
  applyPlayerCommit,
  applyPlayerReveal,
  buildRngPayload,
  createVerifiableRngSession,
  isRevealTimedOut,
  type VerifiableRngSession
} from './verifiable-rng.js';

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
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

interface SantoriniRuntime {
  gameType: 'santorini';
  roomId: string;
  matchId: string;
  state: SantoriniState;
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

interface BackgammonRuntime {
  gameType: 'backgammon';
  roomId: string;
  matchId: string;
  state: BackgammonState;
  rngSession: VerifiableRngSession;
  rngPrng: DeterministicPrng | null;
  players: {
    white: string;
    black: string;
  };
}

interface CardsRuntime {
  gameType: 'cards';
  roomId: string;
  matchId: string;
  state: CardsRuntimeState | null;
  rngSession: VerifiableRngSession;
  rngPrng: DeterministicPrng | null;
  players: {
    black: string;
    white: string;
  };
}

interface LiarsDiceRuntime {
  gameType: 'liars_dice';
  roomId: string;
  matchId: string;
  state: LiarsDiceRuntimeState | null;
  rngSession: VerifiableRngSession;
  rngPrng: DeterministicPrng | null;
  players: {
    black: string;
    white: string;
  };
}

interface Connect4Runtime {
  gameType: 'connect4';
  roomId: string;
  matchId: string;
  state: Connect4State;
  rngSession?: VerifiableRngSession;
  players: {
    red: string;
    yellow: string;
  };
}

interface GoRuntime {
  gameType: 'go';
  roomId: string;
  matchId: string;
  state: GoState;
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

interface ReversiRuntime {
  gameType: 'reversi';
  roomId: string;
  matchId: string;
  state: ReversiState;
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

interface DotsRuntime {
  gameType: 'dots';
  roomId: string;
  matchId: string;
  state: DotsState;
  rngSession?: VerifiableRngSession;
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
  rngSession?: VerifiableRngSession;
  players: {
    red: string;
    black: string;
  };
}

interface QuoridorRuntime {
  gameType: 'quoridor';
  roomId: string;
  matchId: string;
  state: QuoridorState;
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

interface HexRuntime {
  gameType: 'hex';
  roomId: string;
  matchId: string;
  state: HexState;
  rngSession?: VerifiableRngSession;
  players: {
    black: string;
    white: string;
  };
}

type ActiveRuntime =
  | BackgammonRuntime
  | CardsRuntime
  | LiarsDiceRuntime
  | GomokuRuntime
  | SantoriniRuntime
  | Connect4Runtime
  | GoRuntime
  | ReversiRuntime
  | DotsRuntime
  | QuoridorRuntime
  | HexRuntime
  | XiangqiRuntime;

const cardsSuitSchema = z.enum(['clubs', 'diamonds', 'hearts', 'spades']);
const cardsRankSchema = z.enum(['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']);
const cardsCardSchema = z.object({
  suit: cardsSuitSchema,
  rank: cardsRankSchema
});

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

const roomUnsubscribeSchema = z.object({
  type: z.literal('room.unsubscribe'),
  payload: z.object({
    roomId: z.string().uuid()
  })
});

const roomRngCommitSchema = z.object({
  type: z.literal('room.rng.commit'),
  payload: z.object({
    roomId: z.string().uuid(),
    commit: z.string().min(1).max(256)
  })
});

const roomRngRevealSchema = z.object({
  type: z.literal('room.rng.reveal'),
  payload: z.object({
    roomId: z.string().uuid(),
    nonce: z.string().min(1).max(512)
  })
});

const roomMoveSchema = z.union([
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('backgammon'),
      move: z.object({
        from: z.union([z.literal('bar'), z.number().int().min(0).max(23)]),
        to: z.union([z.literal('off'), z.number().int().min(0).max(23)]),
        die: z.number().int().min(1).max(6)
      })
    })
  }),
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
      gameType: z.literal('santorini'),
      move: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('place'),
          worker: z.enum(['a', 'b']),
          x: z.number().int().min(0),
          y: z.number().int().min(0)
        }),
        z.object({
          type: z.literal('turn'),
          worker: z.enum(['a', 'b']),
          to: z.object({
            x: z.number().int().min(0),
            y: z.number().int().min(0)
          }),
          build: z.object({
            x: z.number().int().min(0),
            y: z.number().int().min(0)
          })
        })
      ])
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('connect4'),
      column: z.number().int().min(0)
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('reversi'),
      x: z.number().int().min(0),
      y: z.number().int().min(0)
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('dots'),
      move: z.object({
        orientation: z.enum(['h', 'v']),
        x: z.number().int().min(0),
        y: z.number().int().min(0)
      })
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
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('quoridor'),
      move: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('pawn'),
          x: z.number().int().min(0),
          y: z.number().int().min(0)
        }),
        z.object({
          type: z.literal('wall'),
          orientation: z.enum(['h', 'v']),
          x: z.number().int().min(0),
          y: z.number().int().min(0)
        })
      ])
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('hex'),
      x: z.number().int().min(0),
      y: z.number().int().min(0)
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('liars_dice'),
      move: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('bid'),
          quantity: z.number().int().min(1),
          face: z.number().int().min(1).max(6)
        }),
        z.object({
          type: z.literal('call_liar')
        })
      ])
    })
  }),
  z.object({
    type: z.literal('room.move'),
    payload: z.object({
      roomId: z.string().uuid(),
      gameType: z.literal('cards'),
      move: z.discriminatedUnion('type', [
        z.object({
          type: z.literal('play'),
          card: cardsCardSchema,
          chosenSuit: cardsSuitSchema.optional()
        }),
        z.object({
          type: z.literal('draw')
        }),
        z.object({
          type: z.literal('end_turn')
        })
      ])
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
  payload: z.object({
    gameType: z.enum([
      'gomoku',
      'santorini',
      'go',
      'xiangqi',
      'connect4',
      'reversi',
      'dots',
      'backgammon',
      'cards',
      'quoridor',
      'hex',
      'liars_dice'
    ])
  })
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
const ROOM_INACTIVE_TIMEOUT_MS = 90_000;
const pendingInactiveRoomLeaves = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

function playerSlotsForGame(gameType: BoardGameType): number {
  return gameType === 'gomoku' ||
    gameType === 'santorini' ||
    gameType === 'go' ||
    gameType === 'xiangqi' ||
    gameType === 'connect4' ||
    gameType === 'reversi' ||
    gameType === 'dots' ||
    gameType === 'cards' ||
    gameType === 'quoridor' ||
    gameType === 'hex' ||
    gameType === 'liars_dice'
    ? 2
    : 2;
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

function runtimePlayers(runtime: ActiveRuntime): [string, string] {
  if (
    runtime.gameType === 'backgammon' ||
    runtime.gameType === 'cards' ||
    runtime.gameType === 'liars_dice' ||
    runtime.gameType === 'gomoku' ||
    runtime.gameType === 'santorini' ||
    runtime.gameType === 'go' ||
    runtime.gameType === 'reversi' ||
    runtime.gameType === 'dots' ||
    runtime.gameType === 'quoridor' ||
    runtime.gameType === 'hex'
  ) {
    return [runtime.players.black, runtime.players.white];
  }

  if (runtime.gameType === 'connect4') {
    return [runtime.players.red, runtime.players.yellow];
  }

  return [runtime.players.red, runtime.players.black];
}

function isRuntimeSyncedWithRoom(runtime: ActiveRuntime, room: RoomDTO): boolean {
  if (runtime.gameType !== room.gameType) {
    return false;
  }

  const players = findSeatedPlayers(room);
  if (!players.first || !players.second) {
    return false;
  }

  const [first, second] = runtimePlayers(runtime);
  return first === players.first && second === players.second;
}

function hasRngSession(
  runtime: ActiveRuntime
): runtime is ActiveRuntime & { rngSession: VerifiableRngSession } {
  return Boolean(runtime.rngSession);
}

function rngPhaseReady(runtime: ActiveRuntime): boolean {
  if (!hasRngSession(runtime)) {
    return true;
  }

  return runtime.rngSession.phase === 'ready';
}

function mergeResultPayloadWithRng(
  runtime: ActiveRuntime,
  base: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!hasRngSession(runtime)) {
    return base ?? null;
  }

  return {
    ...(base ?? {}),
    rng: buildRngPayload(runtime.rngSession)
  };
}

function rngUpdatedMessage(
  runtime: ActiveRuntime & { rngSession: VerifiableRngSession }
): ServerToClientMessage {
  return {
    type: 'room.rng.updated',
    payload: {
      roomId: runtime.roomId,
      phase: runtime.rngSession.phase,
      serverSeedCommit: runtime.rngSession.serverSeedCommit,
      commits: runtime.rngSession.playerCommits,
      revealedUsers: Object.entries(runtime.rngSession.playerNonces)
        .filter(([, nonce]) => nonce !== null)
        .map(([userId]) => userId),
      revealDeadlineAt: runtime.rngSession.revealDeadlineAt,
      rngSeed: runtime.rngSession.phase === 'ready' ? runtime.rngSession.rngSeed : null
    }
  };
}

function ensureBackgammonPrng(runtime: BackgammonRuntime): DeterministicPrng | null {
  if (!runtime.rngSession.rngSeed) {
    return null;
  }

  if (runtime.rngPrng) {
    return runtime.rngPrng;
  }

  const prng = createDeterministicPrng(runtime.rngSession.rngSeed);
  for (let roll = 0; roll < runtime.state.rollCount; roll += 1) {
    prng.nextDie();
    prng.nextDie();
  }

  runtime.rngPrng = prng;
  return prng;
}

function maybeRollBackgammonTurn(runtime: BackgammonRuntime): void {
  const prng = ensureBackgammonPrng(runtime);
  if (!prng || runtime.state.status !== 'playing') {
    return;
  }

  // If a rolled turn has no legal moves, auto-pass and roll for opponent.
  for (let guard = 0; guard < 6; guard += 1) {
    const dice: [number, number] = [prng.nextDie(), prng.nextDie()];
    runtime.state = assignBackgammonTurnDice(runtime.state, dice);
    if (hasAnyLegalBackgammonMove(runtime.state, runtime.state.nextPlayer)) {
      return;
    }

    runtime.state = {
      ...runtime.state,
      nextPlayer: runtime.state.nextPlayer === 'white' ? 'black' : 'white',
      dice: null,
      remainingDice: []
    };
  }
}

function ensureCardsPrng(runtime: CardsRuntime): DeterministicPrng | null {
  if (!runtime.rngSession.rngSeed) {
    return null;
  }

  if (runtime.rngPrng) {
    return runtime.rngPrng;
  }

  runtime.rngPrng = createDeterministicPrng(runtime.rngSession.rngSeed);
  return runtime.rngPrng;
}

function ensureCardsRuntimeState(runtime: CardsRuntime): CardsRuntimeState | null {
  if (runtime.state) {
    return runtime.state;
  }

  const prng = ensureCardsPrng(runtime);
  if (!prng) {
    return null;
  }

  const deck = createCardsDeck();
  prng.shuffleInPlace(deck);
  runtime.state = createCardsState({
    deck,
    startingPlayer: 'black'
  });
  return runtime.state;
}

function ensureLiarsDicePrng(runtime: LiarsDiceRuntime): DeterministicPrng | null {
  if (!runtime.rngSession.rngSeed) {
    return null;
  }

  if (runtime.rngPrng) {
    return runtime.rngPrng;
  }

  runtime.rngPrng = createDeterministicPrng(runtime.rngSession.rngSeed);
  return runtime.rngPrng;
}

function ensureLiarsDiceRuntimeState(runtime: LiarsDiceRuntime): LiarsDiceRuntimeState | null {
  if (runtime.state) {
    return runtime.state;
  }

  const prng = ensureLiarsDicePrng(runtime);
  if (!prng) {
    return null;
  }

  runtime.state = createLiarsDiceState({
    dicePerPlayer: 5,
    startingPlayer: 'black',
    rollDie: () => prng.nextDie()
  });
  return runtime.state;
}

function viewerCardsSide(runtime: CardsRuntime, userId: string | null): CardsPlayer | null {
  if (!userId) {
    return null;
  }

  if (runtime.players.black === userId) {
    return 'black';
  }

  if (runtime.players.white === userId) {
    return 'white';
  }

  return null;
}

function viewerLiarsDiceSide(runtime: LiarsDiceRuntime, userId: string | null): LiarsDicePlayer | null {
  if (!userId) {
    return null;
  }

  if (runtime.players.black === userId) {
    return 'black';
  }

  if (runtime.players.white === userId) {
    return 'white';
  }

  return null;
}

function cardsStateForClient(
  runtime: CardsRuntime,
  client: ClientContext
): ReturnType<typeof toCardsPublicState> | null {
  if (!runtime.state) {
    return null;
  }

  const side = viewerCardsSide(runtime, client.user?.id ?? null);
  return toCardsPublicState(runtime.state, side, Boolean(side));
}

function liarsDiceStateForClient(runtime: LiarsDiceRuntime, client: ClientContext): LiarsDiceState | null {
  if (!runtime.state) {
    return null;
  }

  const side = viewerLiarsDiceSide(runtime, client.user?.id ?? null);
  return toLiarsDicePublicState(runtime.state, side);
}

function broadcastCardsMoveApplied(
  runtime: CardsRuntime,
  targets: Set<ClientContext>,
  lastMove: CardsMove
): void {
  for (const target of targets) {
    const state = cardsStateForClient(runtime, target);
    if (!state) {
      continue;
    }

    send(target, {
      type: 'match.move_applied',
      payload: {
        roomId: runtime.roomId,
        gameType: 'cards',
        state,
        lastMove
      }
    });
  }
}

function broadcastLiarsDiceMoveApplied(
  runtime: LiarsDiceRuntime,
  targets: Set<ClientContext>,
  lastMove: LiarsDiceMove
): void {
  for (const target of targets) {
    const state = liarsDiceStateForClient(runtime, target);
    if (!state) {
      continue;
    }

    send(target, {
      type: 'match.move_applied',
      payload: {
        roomId: runtime.roomId,
        gameType: 'liars_dice',
        state,
        lastMove
      }
    });
  }
}

async function abandonForRngRevealTimeout(
  runtime: ActiveRuntime,
  targets: Set<ClientContext>
): Promise<boolean> {
  if (!hasRngSession(runtime) || !isRevealTimedOut(runtime.rngSession)) {
    return false;
  }

  const resultPayload = mergeResultPayloadWithRng(runtime, {
    abandonedReason: 'rng_reveal_timeout'
  }) ?? { abandonedReason: 'rng_reveal_timeout' };

  await completeMatch({
    matchId: runtime.matchId,
    roomId: runtime.roomId,
    winnerUserId: null,
    status: 'abandoned',
    resultPayload
  });

  activeRuntimes.delete(runtime.roomId);
  broadcast(targets, {
    type: 'match.completed',
    payload: {
      roomId: runtime.roomId,
      matchId: runtime.matchId,
      winnerUserId: null,
      resultPayload
    }
  });

  await broadcastRoomStateToSubscribers(runtime.roomId);
  return true;
}

function clearPendingInactiveLeaves(userId: string, roomId?: string): void {
  const byRoom = pendingInactiveRoomLeaves.get(userId);
  if (!byRoom) {
    return;
  }

  if (roomId) {
    const timer = byRoom.get(roomId);
    if (timer) {
      clearTimeout(timer);
      byRoom.delete(roomId);
    }

    if (byRoom.size === 0) {
      pendingInactiveRoomLeaves.delete(userId);
    }
    return;
  }

  for (const timer of byRoom.values()) {
    clearTimeout(timer);
  }
  pendingInactiveRoomLeaves.delete(userId);
}

function collectUserConnectionState(userId: string): ReturnType<typeof aggregateReconnectState> {
  const contexts = Array.from(getUserClients(userId));
  return aggregateReconnectState(
    contexts.map((context) => ({
      reconnectKey: context.reconnectKey,
      lobbySubscribed: context.lobbySubscribed,
      roomIds: context.subscribedRooms
    }))
  );
}

function clearReconnectSnapshotsForUser(userId: string): void {
  for (const [key, snapshot] of reconnectSnapshots) {
    if (snapshot.userId === userId) {
      reconnectSnapshots.delete(key);
    }
  }
}

async function finishMatchIfCompleted(runtime: ActiveRuntime, targets: Set<ClientContext>): Promise<boolean> {
  if (await abandonForRngRevealTimeout(runtime, targets)) {
    return true;
  }

  const completion = deriveRuntimeCompletion(runtime);
  if (!completion) {
    return false;
  }

  const resultPayload = mergeResultPayloadWithRng(runtime, completion.resultPayload);

  await completeMatch({
    matchId: runtime.matchId,
    roomId: runtime.roomId,
    winnerUserId: completion.winnerUserId,
    status: completion.status,
    resultPayload
  });

  activeRuntimes.delete(runtime.roomId);
  broadcast(targets, {
    type: 'match.completed',
    payload: {
      roomId: runtime.roomId,
      matchId: runtime.matchId,
      winnerUserId: completion.winnerUserId,
      resultPayload
    }
  });

  await broadcastRoomStateToSubscribers(runtime.roomId);
  return true;
}

async function broadcastRoomStateToSubscribers(roomId: string): Promise<void> {
  const subscribers = roomSubscribers.get(roomId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  for (const target of subscribers) {
    await sendRoomState(target, roomId);
  }
}

function scheduleInactiveRoomLeaves(userId: string, roomIds: string[]): void {
  if (roomIds.length === 0) {
    return;
  }

  const byRoom = pendingInactiveRoomLeaves.get(userId) ?? new Map<string, ReturnType<typeof setTimeout>>();
  pendingInactiveRoomLeaves.set(userId, byRoom);

  for (const roomId of roomIds) {
    if (byRoom.has(roomId)) {
      continue;
    }

    const timer = setTimeout(() => {
      byRoom.delete(roomId);
      if (byRoom.size === 0) {
        pendingInactiveRoomLeaves.delete(userId);
      }

      if (getUserClients(userId).size > 0) {
        return;
      }

      leaveRoomIfPresent(roomId, userId, 'inactive_timeout')
        .then(async (room) => {
          activeRuntimes.delete(roomId);
          if (!room) {
            return;
          }

          broadcast(roomSubscribers.get(roomId) ?? [], {
            type: 'room.player_left',
            payload: {
              roomId,
              userId
            }
          });
          await broadcastRoomStateToSubscribers(roomId);
        })
        .catch((error) => {
          console.warn(
            'inactive room leave failed',
            error instanceof Error ? error.message : 'unknown_error'
          );
        });
    }, ROOM_INACTIVE_TIMEOUT_MS);

    byRoom.set(roomId, timer);
  }
}

function createRuntime(room: RoomDTO, matchId: string): ActiveRuntime | null {
  const players = findSeatedPlayers(room);
  if (!players.first || !players.second) {
    return null;
  }

  if (room.gameType === 'backgammon') {
    return {
      gameType: 'backgammon',
      roomId: room.id,
      matchId,
      state: createBackgammonState(),
      rngSession: createVerifiableRngSession({
        matchId,
        playerOneUserId: players.first,
        playerTwoUserId: players.second
      }),
      rngPrng: null,
      players: {
        white: players.first,
        black: players.second
      }
    };
  }

  if (room.gameType === 'cards') {
    return {
      gameType: 'cards',
      roomId: room.id,
      matchId,
      state: null,
      rngSession: createVerifiableRngSession({
        matchId,
        playerOneUserId: players.first,
        playerTwoUserId: players.second
      }),
      rngPrng: null,
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'liars_dice') {
    return {
      gameType: 'liars_dice',
      roomId: room.id,
      matchId,
      state: null,
      rngSession: createVerifiableRngSession({
        matchId,
        playerOneUserId: players.first,
        playerTwoUserId: players.second
      }),
      rngPrng: null,
      players: {
        black: players.first,
        white: players.second
      }
    };
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

  if (room.gameType === 'santorini') {
    return {
      gameType: 'santorini',
      roomId: room.id,
      matchId,
      state: createSantoriniState({
        boardSize: 5
      }),
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

  if (room.gameType === 'reversi') {
    return {
      gameType: 'reversi',
      roomId: room.id,
      matchId,
      state: createReversiState(),
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'dots') {
    return {
      gameType: 'dots',
      roomId: room.id,
      matchId,
      state: createDotsState(),
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'connect4') {
    return {
      gameType: 'connect4',
      roomId: room.id,
      matchId,
      state: createConnect4State(),
      players: {
        red: players.first,
        yellow: players.second
      }
    };
  }

  if (room.gameType === 'quoridor') {
    return {
      gameType: 'quoridor',
      roomId: room.id,
      matchId,
      state: createQuoridorState({
        boardSize: 9,
        wallsPerPlayer: 10
      }),
      players: {
        black: players.first,
        white: players.second
      }
    };
  }

  if (room.gameType === 'hex') {
    return {
      gameType: 'hex',
      roomId: room.id,
      matchId,
      state: createHexState({
        boardSize: 11
      }),
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

function isBackgammonStateRecord(value: unknown): value is BackgammonState {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<BackgammonState>;
  return (
    Array.isArray(typed.points) &&
    typed.points.length === 24 &&
    typeof typed.bar?.white === 'number' &&
    typeof typed.bar?.black === 'number' &&
    typeof typed.borneOff?.white === 'number' &&
    typeof typed.borneOff?.black === 'number' &&
    (typed.nextPlayer === 'white' || typed.nextPlayer === 'black') &&
    (typed.status === 'playing' || typed.status === 'completed') &&
    Array.isArray(typed.remainingDice)
  );
}

function isCardsCardRecord(value: unknown): value is CardsCard {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<CardsCard>;
  return (
    (typed.suit === 'clubs' ||
      typed.suit === 'diamonds' ||
      typed.suit === 'hearts' ||
      typed.suit === 'spades') &&
    (typed.rank === 'A' ||
      typed.rank === '2' ||
      typed.rank === '3' ||
      typed.rank === '4' ||
      typed.rank === '5' ||
      typed.rank === '6' ||
      typed.rank === '7' ||
      typed.rank === '8' ||
      typed.rank === '9' ||
      typed.rank === '10' ||
      typed.rank === 'J' ||
      typed.rank === 'Q' ||
      typed.rank === 'K')
  );
}

function isCardsMoveRecord(value: unknown): value is CardsMove {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<CardsMove>;
  if (typed.type === 'draw' || typed.type === 'end_turn') {
    return typed.player === 'black' || typed.player === 'white';
  }

  if (typed.type === 'play') {
    return (
      (typed.player === 'black' || typed.player === 'white') &&
      isCardsCardRecord(typed.card) &&
      (typed.chosenSuit === undefined ||
        typed.chosenSuit === 'clubs' ||
        typed.chosenSuit === 'diamonds' ||
        typed.chosenSuit === 'hearts' ||
        typed.chosenSuit === 'spades')
    );
  }

  return false;
}

function readCardsMovePayload(payload: Record<string, unknown>): CardsMove | null {
  const nested = payload.move;
  if (isCardsMoveRecord(nested)) {
    return nested;
  }

  return isCardsMoveRecord(payload) ? payload : null;
}

function isLiarsDiceMoveRecord(value: unknown): value is LiarsDiceMove {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<LiarsDiceMove>;
  if (typed.type === 'call_liar') {
    return typed.player === 'black' || typed.player === 'white';
  }

  if (typed.type === 'bid') {
    return (
      (typed.player === 'black' || typed.player === 'white') &&
      typeof typed.quantity === 'number' &&
      Number.isInteger(typed.quantity) &&
      typed.quantity > 0 &&
      typeof typed.face === 'number' &&
      Number.isInteger(typed.face) &&
      typed.face >= 1 &&
      typed.face <= 6
    );
  }

  return false;
}

function readLiarsDiceMovePayload(payload: Record<string, unknown>): LiarsDiceMove | null {
  const nested = payload.move;
  if (isLiarsDiceMoveRecord(nested)) {
    return nested;
  }

  return isLiarsDiceMoveRecord(payload) ? payload : null;
}

function isSantoriniPositionRecord(value: unknown): value is SantoriniState['workers']['black']['a'] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<NonNullable<SantoriniState['workers']['black']['a']>>;
  return (
    typeof typed.x === 'number' &&
    Number.isInteger(typed.x) &&
    typeof typed.y === 'number' &&
    Number.isInteger(typed.y)
  );
}

function isSantoriniMoveRecord(value: unknown): value is SantoriniMove {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const typed = value as Partial<SantoriniMove>;
  if (typed.type === 'place') {
    return (
      (typed.player === 'black' || typed.player === 'white') &&
      (typed.worker === 'a' || typed.worker === 'b') &&
      typeof typed.x === 'number' &&
      Number.isInteger(typed.x) &&
      typeof typed.y === 'number' &&
      Number.isInteger(typed.y)
    );
  }

  if (typed.type === 'turn') {
    return (
      (typed.player === 'black' || typed.player === 'white') &&
      (typed.worker === 'a' || typed.worker === 'b') &&
      isSantoriniPositionRecord(typed.to) &&
      isSantoriniPositionRecord(typed.build)
    );
  }

  return false;
}

function readSantoriniMovePayload(payload: Record<string, unknown>): SantoriniMove | null {
  const nested = payload.move;
  if (isSantoriniMoveRecord(nested)) {
    return nested;
  }

  return isSantoriniMoveRecord(payload) ? payload : null;
}

function replayMoves(
  runtime: ActiveRuntime,
  moves: Array<{ payload: Record<string, unknown> }>
): ActiveRuntime {
  let current = runtime;

  for (const move of moves) {
    if (current.gameType === 'backgammon') {
      const payload = move.payload as {
        state?: BackgammonState;
        rngSeed?: string;
      };
      if (isBackgammonStateRecord(payload.state)) {
        current = {
          ...current,
          state: payload.state,
          rngSession: payload.rngSeed
            ? {
                ...current.rngSession,
                phase: 'ready',
                rngSeed: payload.rngSeed,
                revealDeadlineAt: null
              }
            : current.rngSession,
          rngPrng: null
        };
      }
      continue;
    }

    if (current.gameType === 'cards') {
      const payload = move.payload as {
        move?: Record<string, unknown>;
        rngSeed?: string;
      };
      if (typeof payload.rngSeed === 'string' && payload.rngSeed.length > 0) {
        current = {
          ...current,
          rngSession: {
            ...current.rngSession,
            phase: 'ready',
            rngSeed: payload.rngSeed,
            revealDeadlineAt: null
          },
          rngPrng: null
        };
      }

      if (current.rngSession.phase === 'ready') {
        ensureCardsRuntimeState(current);
      }

      const parsedMove = readCardsMovePayload(move.payload);
      if (!parsedMove || !current.state) {
        continue;
      }

      const applied = applyCardsMove(current.state, parsedMove);
      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'liars_dice') {
      const payload = move.payload as {
        move?: Record<string, unknown>;
        rngSeed?: string;
      };
      if (typeof payload.rngSeed === 'string' && payload.rngSeed.length > 0) {
        current = {
          ...current,
          rngSession: {
            ...current.rngSession,
            phase: 'ready',
            rngSeed: payload.rngSeed,
            revealDeadlineAt: null
          },
          rngPrng: null
        };
      }

      if (current.rngSession.phase === 'ready') {
        ensureLiarsDiceRuntimeState(current);
      }

      const parsedMove = readLiarsDiceMovePayload(move.payload);
      if (!parsedMove || !current.state) {
        continue;
      }

      const prng = ensureLiarsDicePrng(current);
      if (!prng) {
        continue;
      }

      const applied = applyLiarsDiceMove(current.state, parsedMove, () => prng.nextDie());
      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

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

      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'santorini') {
      const parsedMove = readSantoriniMovePayload(move.payload);
      if (!parsedMove) {
        continue;
      }

      const applied = applySantoriniMove(current.state, parsedMove);
      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'connect4') {
      const payload = move.payload as { column?: number; player?: Connect4Move['player'] };
      if (typeof payload.column !== 'number') {
        continue;
      }

      const player = payload.player ?? current.state.nextPlayer;
      const applied = applyConnect4Move(current.state, {
        column: payload.column,
        player
      });

      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'reversi') {
      const payload = move.payload as { x?: number; y?: number; player?: ReversiMove['player'] };
      if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
        continue;
      }

      const player = payload.player ?? current.state.nextPlayer;
      const applied = applyReversiMove(current.state, {
        x: payload.x,
        y: payload.y,
        player
      });

      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'dots') {
      const payload = move.payload as Partial<DotsMove> & { move?: Partial<DotsMove> };
      const source = payload.move ?? payload;
      if (!source || typeof source.x !== 'number' || typeof source.y !== 'number') {
        continue;
      }

      if (source.orientation !== 'h' && source.orientation !== 'v') {
        continue;
      }

      const applied = applyDotsMove(current.state, {
        orientation: source.orientation,
        x: source.x,
        y: source.y,
        player: source.player ?? current.state.nextPlayer
      });

      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'quoridor') {
      const payload = move.payload as Partial<QuoridorMove> & { move?: Partial<QuoridorMove> };
      const source = payload.move ?? payload;
      if (!source || (source.type !== 'pawn' && source.type !== 'wall')) {
        continue;
      }

      let normalizedMove: QuoridorMove | null = null;
      if (
        source.type === 'pawn' &&
        typeof source.x === 'number' &&
        typeof source.y === 'number' &&
        Number.isInteger(source.x) &&
        Number.isInteger(source.y)
      ) {
        normalizedMove = {
          type: 'pawn',
          x: source.x,
          y: source.y,
          player: source.player ?? current.state.nextPlayer
        };
      }

      if (
        source.type === 'wall' &&
        typeof source.x === 'number' &&
        typeof source.y === 'number' &&
        Number.isInteger(source.x) &&
        Number.isInteger(source.y) &&
        (source.orientation === 'h' || source.orientation === 'v')
      ) {
        normalizedMove = {
          type: 'wall',
          orientation: source.orientation,
          x: source.x,
          y: source.y,
          player: source.player ?? current.state.nextPlayer
        };
      }

      if (!normalizedMove) {
        continue;
      }

      const applied = applyQuoridorMove(current.state, normalizedMove);
      if (!applied.accepted) {
        continue;
      }

      current = {
        ...current,
        state: applied.nextState
      };
      continue;
    }

    if (current.gameType === 'hex') {
      const payload = move.payload as Partial<HexMove>;
      if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
        continue;
      }

      const applied = applyHexMove(current.state, {
        x: payload.x,
        y: payload.y,
        player: payload.player ?? current.state.nextPlayer
      });
      if (!applied.accepted) {
        continue;
      }

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
      if (!applied.accepted) {
        continue;
      }
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
    if (!applied.accepted) {
      continue;
    }
    current = {
      ...current,
      state: applied.nextState
    };
  }

  return current;
}

async function getOrLoadRuntime(roomId: string): Promise<ActiveRuntime | null> {
  const room = await reconcileRoomLifecycle(roomId, 'stale_match_recovery');
  if (!room || room.gameType === 'single_2048') {
    activeRuntimes.delete(roomId);
    return null;
  }

  const seated = findSeatedPlayers(room);
  if (!seated.first || !seated.second) {
    activeRuntimes.delete(roomId);
    return null;
  }

  const existing = activeRuntimes.get(roomId);
  if (existing) {
    if (isRuntimeSyncedWithRoom(existing, room)) {
      return existing;
    }
    activeRuntimes.delete(roomId);
  }

  const match = await getLatestMatchForRoom(roomId);
  if (!match || match.gameType === 'single_2048') {
    return null;
  }

  const base = createRuntime(room, match.id);
  if (!base) {
    return null;
  }

  const replayed = replayMoves(base, match.moves);
  if (replayed.gameType === 'backgammon' && replayed.rngSession.phase === 'ready') {
    ensureBackgammonPrng(replayed);
    if (replayed.state.status === 'playing' && replayed.state.remainingDice.length === 0) {
      maybeRollBackgammonTurn(replayed);
    }
  }
  if (replayed.gameType === 'cards' && replayed.rngSession.phase === 'ready') {
    ensureCardsRuntimeState(replayed);
  }
  if (replayed.gameType === 'liars_dice' && replayed.rngSession.phase === 'ready') {
    ensureLiarsDiceRuntimeState(replayed);
  }

  if (match.status === 'active') {
    if (hasRngSession(replayed) && isRevealTimedOut(replayed.rngSession)) {
      activeRuntimes.delete(roomId);
      const timeoutPayload = mergeResultPayloadWithRng(replayed, {
        abandonedReason: 'rng_reveal_timeout'
      }) ?? { abandonedReason: 'rng_reveal_timeout' };
      try {
        await completeMatch({
          matchId: match.id,
          roomId,
          winnerUserId: null,
          status: 'abandoned',
          resultPayload: timeoutPayload
        });
      } catch (error) {
        console.warn(
          'stale rng reveal timeout recovery failed',
          error instanceof Error ? error.message : 'unknown_error'
        );
      }
      return replayed;
    }

    const completion = deriveRuntimeCompletion(replayed);
    if (completion) {
      activeRuntimes.delete(roomId);
      const resultPayload = mergeResultPayloadWithRng(replayed, completion.resultPayload);
      try {
        await completeMatch({
          matchId: match.id,
          roomId,
          winnerUserId: completion.winnerUserId,
          status: completion.status,
          resultPayload
        });
      } catch (error) {
        console.warn(
          'stale active match recovery failed',
          error instanceof Error ? error.message : 'unknown_error'
        );
      }
      return replayed;
    }
    activeRuntimes.set(roomId, replayed);
  }

  return replayed;
}

async function ensureRoomMatchIfReady(roomId: string): Promise<ActiveRuntime | null> {
  const existing = await getOrLoadRuntime(roomId);
  if (
    existing &&
    (((existing.gameType === 'cards' || existing.gameType === 'liars_dice') &&
      existing.state?.status === 'playing') ||
      (existing.gameType === 'santorini' && existing.state.status !== 'completed') ||
      (existing.gameType !== 'cards' &&
        existing.gameType !== 'santorini' &&
        existing.gameType !== 'liars_dice' &&
        existing.state.status === 'playing'))
  ) {
    return existing;
  }

  const room = await reconcileRoomLifecycle(roomId, 'stale_match_recovery');
  if (!room || room.gameType === 'single_2048') {
    return null;
  }

  const players = room.players.filter((player) => player.role === 'player');
  if (players.length < playerSlotsForGame(room.gameType)) {
    return null;
  }

  let matchId: string;
  try {
    matchId = await createMatchForRoom(room.id);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === 'room_not_found' || error.message === 'not_enough_players')
    ) {
      return null;
    }
    throw error;
  }

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

  const runtime = await getOrLoadRuntime(roomId);
  const room = await reconcileRoomLifecycle(roomId, 'stale_match_recovery');
  if (!room) {
    sendError(client, 'room_not_found');
    return;
  }

  const viewerRole = getViewerRole(room, client.user.id);

  if (room.gameType === 'backgammon') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'backgammon',
        state: runtime?.gameType === 'backgammon' ? runtime.state : createBackgammonState(),
        viewerRole
      }
    });
    if (runtime?.gameType === 'backgammon') {
      send(client, rngUpdatedMessage(runtime));
    }
    return;
  }

  if (room.gameType === 'liars_dice') {
    if (runtime?.gameType === 'liars_dice' && runtime.rngSession.phase === 'ready') {
      ensureLiarsDiceRuntimeState(runtime);
    }

    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'liars_dice',
        state: runtime?.gameType === 'liars_dice' ? liarsDiceStateForClient(runtime, client) : null,
        viewerRole
      }
    });
    if (runtime?.gameType === 'liars_dice') {
      send(client, rngUpdatedMessage(runtime));
    }
    return;
  }

  if (room.gameType === 'cards') {
    if (runtime?.gameType === 'cards' && runtime.rngSession.phase === 'ready') {
      ensureCardsRuntimeState(runtime);
    }

    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'cards',
        state: runtime?.gameType === 'cards' ? cardsStateForClient(runtime, client) : null,
        viewerRole
      }
    });
    if (runtime?.gameType === 'cards') {
      send(client, rngUpdatedMessage(runtime));
    }
    return;
  }

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

  if (room.gameType === 'santorini') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'santorini',
        state: runtime?.gameType === 'santorini' ? runtime.state : createSantoriniState({ boardSize: 5 }),
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

  if (room.gameType === 'reversi') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'reversi',
        state: runtime?.gameType === 'reversi' ? runtime.state : createReversiState(),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'dots') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'dots',
        state: runtime?.gameType === 'dots' ? runtime.state : createDotsState(),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'connect4') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'connect4',
        state: runtime?.gameType === 'connect4' ? runtime.state : createConnect4State(),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'quoridor') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'quoridor',
        state:
          runtime?.gameType === 'quoridor'
            ? runtime.state
            : createQuoridorState({
                boardSize: 9,
                wallsPerPlayer: 10
              }),
        viewerRole
      }
    });
    return;
  }

  if (room.gameType === 'hex') {
    send(client, {
      type: 'room.state',
      payload: {
        room,
        gameType: 'hex',
        state:
          runtime?.gameType === 'hex'
            ? runtime.state
            : createHexState({
                boardSize: 11
              }),
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

  await finishMatchIfCompleted(runtime, targets);
}

async function handleSantoriniMove(
  client: ClientContext,
  runtime: SantoriniRuntime,
  move: SantoriniMoveInput
): Promise<void> {
  const userId = client.user!.id;
  const player: SantoriniPlayer | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove = normalizeSantoriniMove(move, player);
  const applied = applySantoriniMove(runtime.state, normalizedMove);
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
    moveType: normalizedMove.type === 'place' ? 'santorini.place_worker' : 'santorini.turn',
    payload: {
      move: normalizedMove
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'santorini',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleConnect4Move(
  client: ClientContext,
  runtime: Connect4Runtime,
  column: number
): Promise<void> {
  const userId = client.user!.id;
  const playerDisc: Connect4Move['player'] | null =
    runtime.players.red === userId ? 'red' : runtime.players.yellow === userId ? 'yellow' : null;

  if (!playerDisc) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const applied = applyConnect4Move(runtime.state, {
    column,
    player: playerDisc
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
    moveType: 'connect4.drop_disc',
    payload: {
      column,
      player: playerDisc
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'connect4',
      state: runtime.state,
      lastMove: {
        column,
        player: playerDisc
      }
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleBackgammonMove(
  client: ClientContext,
  runtime: BackgammonRuntime,
  move: Pick<BackgammonMove, 'from' | 'to' | 'die'>
): Promise<void> {
  const userId = client.user!.id;
  const playerColor: BackgammonMove['player'] | null =
    runtime.players.white === userId ? 'white' : runtime.players.black === userId ? 'black' : null;

  if (!playerColor) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove: BackgammonMove = {
    from: move.from,
    to: move.to,
    die: move.die,
    player: playerColor
  };

  const applied = applyBackgammonMove(runtime.state, normalizedMove);
  if (!applied.accepted) {
    sendError(client, applied.reason ?? 'invalid_move');
    return;
  }

  runtime.state = applied.nextState;
  if (runtime.state.status === 'playing' && applied.turnEnded) {
    maybeRollBackgammonTurn(runtime);
  }
  activeRuntimes.set(runtime.roomId, runtime);

  await createMatchMove({
    matchId: runtime.matchId,
    actorUserId: userId,
    moveIndex: runtime.state.moveCount,
    moveType: 'backgammon.move_checker',
    payload: {
      ...normalizedMove,
      usedDie: applied.usedDie,
      turnEnded: applied.turnEnded,
      state: runtime.state,
      rngSeed: runtime.rngSession.rngSeed
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'backgammon',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleCardsMove(
  client: ClientContext,
  runtime: CardsRuntime,
  move: CardsMoveInput
): Promise<void> {
  const userId = client.user!.id;
  const player: CardsPlayer | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const state = ensureCardsRuntimeState(runtime);
  if (!state) {
    sendError(client, 'rng_reveal_pending');
    return;
  }

  const normalizedMove: CardsMove =
    move.type === 'play'
      ? {
          type: 'play',
          player,
          card: move.card,
          chosenSuit: move.chosenSuit
        }
      : move.type === 'draw'
        ? {
            type: 'draw',
            player
          }
        : {
            type: 'end_turn',
            player
          };

  const applied = applyCardsMove(state, normalizedMove);
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
    moveType: `cards.${normalizedMove.type}`,
    payload: {
      move: normalizedMove,
      rngSeed: runtime.rngSession.rngSeed
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcastCardsMoveApplied(runtime, targets, normalizedMove);
  await finishMatchIfCompleted(runtime, targets);
}

async function handleLiarsDiceMove(
  client: ClientContext,
  runtime: LiarsDiceRuntime,
  move: LiarsDiceMoveInput
): Promise<void> {
  const userId = client.user!.id;
  const player: LiarsDicePlayer | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const state = ensureLiarsDiceRuntimeState(runtime);
  if (!state) {
    sendError(client, 'rng_reveal_pending');
    return;
  }

  const prng = ensureLiarsDicePrng(runtime);
  if (!prng) {
    sendError(client, 'rng_reveal_pending');
    return;
  }

  const normalizedMove: LiarsDiceMove =
    move.type === 'bid'
      ? {
          type: 'bid',
          quantity: move.quantity,
          face: move.face,
          player
        }
      : {
          type: 'call_liar',
          player
        };

  const applied = applyLiarsDiceMove(state, normalizedMove, () => prng.nextDie());
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
    moveType: `liars_dice.${normalizedMove.type}`,
    payload: {
      move: normalizedMove,
      rngSeed: runtime.rngSession.rngSeed
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcastLiarsDiceMoveApplied(runtime, targets, normalizedMove);
  await finishMatchIfCompleted(runtime, targets);
}

async function handleReversiMove(
  client: ClientContext,
  runtime: ReversiRuntime,
  x: number,
  y: number
): Promise<void> {
  const userId = client.user!.id;
  const playerDisc: ReversiMove['player'] | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!playerDisc) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const applied = applyReversiMove(runtime.state, {
    x,
    y,
    player: playerDisc
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
    moveType: 'reversi.place_disc',
    payload: {
      x,
      y,
      player: playerDisc
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'reversi',
      state: runtime.state,
      lastMove: {
        x,
        y,
        player: playerDisc
      }
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleDotsMove(
  client: ClientContext,
  runtime: DotsRuntime,
  move: Pick<DotsMove, 'orientation' | 'x' | 'y'>
): Promise<void> {
  const userId = client.user!.id;
  const player: DotsMove['player'] | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove: DotsMove = {
    orientation: move.orientation,
    x: move.x,
    y: move.y,
    player
  };

  const applied = applyDotsMove(runtime.state, normalizedMove);
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
    moveType: 'dots.draw_line',
    payload: normalizedMove as unknown as Record<string, unknown>
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'dots',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleQuoridorMove(
  client: ClientContext,
  runtime: QuoridorRuntime,
  move: QuoridorMoveInput
): Promise<void> {
  const userId = client.user!.id;
  const player: QuoridorMove['player'] | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const normalizedMove: QuoridorMove =
    move.type === 'pawn'
      ? {
          type: 'pawn',
          x: move.x,
          y: move.y,
          player
        }
      : {
          type: 'wall',
          orientation: move.orientation,
          x: move.x,
          y: move.y,
          player
        };

  const applied = applyQuoridorMove(runtime.state, normalizedMove);
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
    moveType: normalizedMove.type === 'pawn' ? 'quoridor.move_pawn' : 'quoridor.place_wall',
    payload: normalizedMove as unknown as Record<string, unknown>
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'quoridor',
      state: runtime.state,
      lastMove: normalizedMove
    }
  });

  await finishMatchIfCompleted(runtime, targets);
}

async function handleHexMove(
  client: ClientContext,
  runtime: HexRuntime,
  x: number,
  y: number
): Promise<void> {
  const userId = client.user!.id;
  const player: HexMove['player'] | null =
    runtime.players.black === userId ? 'black' : runtime.players.white === userId ? 'white' : null;

  if (!player) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const applied = applyHexMove(runtime.state, {
    x,
    y,
    player
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
    moveType: 'hex.place_stone',
    payload: {
      x,
      y,
      player
    }
  });

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  broadcast(targets, {
    type: 'match.move_applied',
    payload: {
      roomId: runtime.roomId,
      gameType: 'hex',
      state: runtime.state,
      lastMove: {
        x,
        y,
        player
      }
    }
  });

  await finishMatchIfCompleted(runtime, targets);
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

  await finishMatchIfCompleted(runtime, targets);
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
  const notation = formatXiangqiMoveNotation(runtime.state, normalizedMove);

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
    payload: {
      ...normalizedMove,
      notation,
      moveLog: {
        from: normalizedMove.from,
        to: normalizedMove.to,
        player: normalizedMove.player,
        notation
      }
    }
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

  await finishMatchIfCompleted(runtime, targets);
}

async function handleRngCommit(client: ClientContext, roomId: string, commit: string): Promise<void> {
  if (!client.user) {
    sendError(client, 'not_authenticated');
    return;
  }

  if (!client.subscribedRooms.has(roomId)) {
    sendError(client, 'room_not_subscribed');
    return;
  }

  const runtime = await getOrLoadRuntime(roomId);
  if (!runtime) {
    sendError(client, 'no_active_match');
    return;
  }

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  if (await abandonForRngRevealTimeout(runtime, targets)) {
    return;
  }

  if (!hasRngSession(runtime)) {
    sendError(client, 'rng_not_required');
    return;
  }

  const [first, second] = runtimePlayers(runtime);
  if (client.user.id !== first && client.user.id !== second) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const committed = applyPlayerCommit(runtime.rngSession, client.user.id, commit, Date.now());
  if (!committed.accepted) {
    sendError(client, committed.reason ?? 'rng_commit_rejected');
    return;
  }

  runtime.rngSession = committed.session;
  activeRuntimes.set(runtime.roomId, runtime);
  broadcast(targets, rngUpdatedMessage(runtime));
}

async function handleRngReveal(client: ClientContext, roomId: string, nonce: string): Promise<void> {
  if (!client.user) {
    sendError(client, 'not_authenticated');
    return;
  }

  if (!client.subscribedRooms.has(roomId)) {
    sendError(client, 'room_not_subscribed');
    return;
  }

  const runtime = await getOrLoadRuntime(roomId);
  if (!runtime) {
    sendError(client, 'no_active_match');
    return;
  }

  const targets = roomSubscribers.get(runtime.roomId) ?? new Set<ClientContext>();
  if (await abandonForRngRevealTimeout(runtime, targets)) {
    return;
  }

  if (!hasRngSession(runtime)) {
    sendError(client, 'rng_not_required');
    return;
  }

  const [first, second] = runtimePlayers(runtime);
  if (client.user.id !== first && client.user.id !== second) {
    sendError(client, 'not_a_match_player');
    return;
  }

  const revealed = applyPlayerReveal(runtime.rngSession, client.user.id, nonce);
  if (!revealed.accepted) {
    sendError(client, revealed.reason ?? 'rng_reveal_rejected');
    return;
  }

  const becameReady = runtime.rngSession.phase !== 'ready' && revealed.session.phase === 'ready';
  runtime.rngSession = revealed.session;
  if (
    runtime.gameType === 'backgammon' &&
    runtime.rngSession.phase === 'ready' &&
    runtime.state.status === 'playing' &&
    runtime.state.rollCount === 0
  ) {
    runtime.rngPrng = null;
    maybeRollBackgammonTurn(runtime);
  }
  if (runtime.gameType === 'cards' && runtime.rngSession.phase === 'ready') {
    runtime.rngPrng = null;
    ensureCardsRuntimeState(runtime);
    if (becameReady) {
      await createMatchMove({
        matchId: runtime.matchId,
        actorUserId: client.user.id,
        moveIndex: 0,
        moveType: 'cards.rng_ready',
        payload: {
          rngSeed: runtime.rngSession.rngSeed
        }
      });
    }
  }
  if (runtime.gameType === 'liars_dice' && runtime.rngSession.phase === 'ready') {
    runtime.rngPrng = null;
    ensureLiarsDiceRuntimeState(runtime);
    if (becameReady) {
      await createMatchMove({
        matchId: runtime.matchId,
        actorUserId: client.user.id,
        moveIndex: 0,
        moveType: 'liars_dice.rng_ready',
        payload: {
          rngSeed: runtime.rngSession.rngSeed
        }
      });
    }
  }
  activeRuntimes.set(runtime.roomId, runtime);
  broadcast(targets, rngUpdatedMessage(runtime));
  if (
    (runtime.gameType === 'backgammon' ||
      runtime.gameType === 'cards' ||
      runtime.gameType === 'liars_dice') &&
    runtime.rngSession.phase === 'ready'
  ) {
    await broadcastRoomStateToSubscribers(runtime.roomId);
  }
}

async function handleMove(
  client: ClientContext,
  message:
    | { roomId: string; gameType: 'backgammon'; move: Pick<BackgammonMove, 'from' | 'to' | 'die'> }
    | { roomId: string; gameType: 'cards'; move: CardsMoveInput }
    | { roomId: string; gameType: 'liars_dice'; move: LiarsDiceMoveInput }
    | { roomId: string; gameType: 'gomoku'; x: number; y: number }
    | { roomId: string; gameType: 'santorini'; move: SantoriniMoveInput }
    | { roomId: string; gameType: 'connect4'; column: number }
    | { roomId: string; gameType: 'reversi'; x: number; y: number }
    | { roomId: string; gameType: 'dots'; move: Pick<DotsMove, 'orientation' | 'x' | 'y'> }
    | { roomId: string; gameType: 'quoridor'; move: QuoridorMoveInput }
    | { roomId: string; gameType: 'hex'; x: number; y: number }
    | { roomId: string; gameType: 'go'; move: GoMove }
    | { roomId: string; gameType: 'xiangqi'; move: XiangqiMove }
): Promise<void> {
  if (!client.user) {
    sendError(client, 'not_authenticated');
    return;
  }

  if (!client.subscribedRooms.has(message.roomId)) {
    sendError(client, 'room_not_subscribed');
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

  if (!rngPhaseReady(runtime)) {
    sendError(client, 'rng_reveal_pending');
    return;
  }

  if (message.gameType === 'backgammon' && runtime.gameType === 'backgammon') {
    await handleBackgammonMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'cards' && runtime.gameType === 'cards') {
    await handleCardsMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'liars_dice' && runtime.gameType === 'liars_dice') {
    await handleLiarsDiceMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'gomoku' && runtime.gameType === 'gomoku') {
    await handleGomokuMove(client, runtime, message.x, message.y);
    return;
  }

  if (message.gameType === 'santorini' && runtime.gameType === 'santorini') {
    await handleSantoriniMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'connect4' && runtime.gameType === 'connect4') {
    await handleConnect4Move(client, runtime, message.column);
    return;
  }

  if (message.gameType === 'reversi' && runtime.gameType === 'reversi') {
    await handleReversiMove(client, runtime, message.x, message.y);
    return;
  }

  if (message.gameType === 'dots' && runtime.gameType === 'dots') {
    await handleDotsMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'quoridor' && runtime.gameType === 'quoridor') {
    await handleQuoridorMove(client, runtime, message.move);
    return;
  }

  if (message.gameType === 'hex' && runtime.gameType === 'hex') {
    await handleHexMove(client, runtime, message.x, message.y);
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

async function handleIdleRoomCloseSweep(): Promise<void> {
  const closedRoomIds = await closeIdleRooms(config.roomIdleCloseMinutes);
  if (closedRoomIds.length === 0) {
    return;
  }

  for (const roomId of closedRoomIds) {
    activeRuntimes.delete(roomId);
    await broadcastRoomStateToSubscribers(roomId);
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
        clearPendingInactiveLeaves(user.id);

        if (msg.payload.reconnectKey) {
          const snapshot = reconnectSnapshots.get(msg.payload.reconnectKey);
          if (snapshot && snapshot.userId === user.id && snapshot.expiresAt > Date.now()) {
            client.reconnectKey = msg.payload.reconnectKey;
            client.lobbySubscribed = snapshot.lobbySubscribed;
            clearReconnectSnapshotsForUser(user.id);

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
        let room = await reconcileRoomLifecycle(msg.payload.roomId, 'stale_match_recovery');
        if (!room) {
          sendError(client, 'room_not_found');
          return;
        }

        clearPendingInactiveLeaves(authedUser.id, msg.payload.roomId);

        const isMember = room.players.some((player) => player.userId === authedUser.id);
        if (!isMember && !msg.payload.asSpectator) {
          sendError(client, 'room_access_denied');
          return;
        }

        if (!isMember && msg.payload.asSpectator) {
          const joined = await joinRoomIfPossible(msg.payload.roomId, authedUser.id, true);
          if (!joined) {
            sendError(client, 'room_join_failed');
            return;
          }
          room = joined;
        }

        const firstSubscriptionForUser = !isUserSubscribedToRoom(authedUser.id, msg.payload.roomId);
        if (firstSubscriptionForUser) {
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
        await touchRoomLastActiveAt(msg.payload.roomId);

        await ensureRoomMatchIfReady(msg.payload.roomId);
        await broadcastRoomStateToSubscribers(msg.payload.roomId);
        return;
      }

      if (parsed.type === 'room.unsubscribe') {
        const msg = roomUnsubscribeSchema.parse(parsed);
        if (client.subscribedRooms.has(msg.payload.roomId)) {
          removeRoomSubscription(client, msg.payload.roomId);
          if (!isUserSubscribedToRoom(authedUser.id, msg.payload.roomId)) {
            broadcast(roomSubscribers.get(msg.payload.roomId) ?? [], {
              type: 'room.player_left',
              payload: {
                roomId: msg.payload.roomId,
                userId: authedUser.id
              }
            });
          }
        }
        return;
      }

      if (parsed.type === 'room.rng.commit') {
        const msg = roomRngCommitSchema.parse(parsed);
        await handleRngCommit(client, msg.payload.roomId, msg.payload.commit);
        return;
      }

      if (parsed.type === 'room.rng.reveal') {
        const msg = roomRngRevealSchema.parse(parsed);
        await handleRngReveal(client, msg.payload.roomId, msg.payload.nonce);
        return;
      }

      if (parsed.type === 'room.move') {
        const msg = roomMoveSchema.parse(parsed);

        if (msg.payload.gameType === 'backgammon') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'backgammon',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'cards') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'cards',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'liars_dice') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'liars_dice',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'gomoku') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'gomoku',
            x: msg.payload.x,
            y: msg.payload.y
          });
          return;
        }

        if (msg.payload.gameType === 'santorini') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'santorini',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'connect4') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'connect4',
            column: msg.payload.column
          });
          return;
        }

        if (msg.payload.gameType === 'reversi') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'reversi',
            x: msg.payload.x,
            y: msg.payload.y
          });
          return;
        }

        if (msg.payload.gameType === 'dots') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'dots',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'quoridor') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'quoridor',
            move: msg.payload.move
          });
          return;
        }

        if (msg.payload.gameType === 'hex') {
          await handleMove(client, {
            roomId: msg.payload.roomId,
            gameType: 'hex',
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
            }

            await ensureRoomMatchIfReady(room.id);
            await broadcastRoomStateToSubscribers(room.id);
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
    const userId = client.user?.id ?? null;
    const connectionState = userId ? collectUserConnectionState(userId) : null;

    const subscribedRoomIds = Array.from(client.subscribedRooms);

    for (const roomId of subscribedRoomIds) {
      removeRoomSubscription(client, roomId);
      if (userId && !isUserSubscribedToRoom(userId, roomId)) {
        broadcast(roomSubscribers.get(roomId) ?? [], {
          type: 'room.player_left',
          payload: {
            roomId,
            userId
          }
        });
      }
    }

    detachUser(client);
    clients.delete(client);

    if (userId && getUserClients(userId).size === 0) {
      matchmakingQueue.markDisconnected(userId);

      const snapshotState = connectionState ?? {
        reconnectKeys: [client.reconnectKey],
        lobbySubscribed: client.lobbySubscribed,
        roomIds: subscribedRoomIds
      };

      for (const reconnectKey of snapshotState.reconnectKeys) {
        reconnectSnapshots.set(reconnectKey, {
          userId,
          lobbySubscribed: snapshotState.lobbySubscribed,
          roomIds: snapshotState.roomIds,
          expiresAt: Date.now() + 60_000
        });
      }

      scheduleInactiveRoomLeaves(userId, snapshotState.roomIds);
    }
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

const roomLifecycleSweepInterval = setInterval(() => {
  for (const roomId of activeRuntimes.keys()) {
    reconcileRoomLifecycle(roomId, 'stale_match_recovery')
      .then(async (room) => {
        const runtime = activeRuntimes.get(roomId);
        if (!runtime) {
          return;
        }

        const targets = roomSubscribers.get(roomId) ?? new Set<ClientContext>();
        if (await abandonForRngRevealTimeout(runtime, targets)) {
          return;
        }

        if (!room || !isRuntimeSyncedWithRoom(runtime, room)) {
          activeRuntimes.delete(roomId);
          await broadcastRoomStateToSubscribers(roomId);
        }
      })
      .catch((error) => {
        console.warn('room lifecycle sweep failed', error instanceof Error ? error.message : 'unknown_error');
      });
  }
}, 7_000);

const idleRoomCloseSweepInterval = setInterval(() => {
  handleIdleRoomCloseSweep().catch((error) => {
    console.warn('idle room close sweep failed', error instanceof Error ? error.message : 'unknown_error');
  });
}, config.roomIdleCloseSweepMinutes * 60_000);

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
  clearInterval(roomLifecycleSweepInterval);
  clearInterval(idleRoomCloseSweepInterval);
  for (const byRoom of pendingInactiveRoomLeaves.values()) {
    for (const timer of byRoom.values()) {
      clearTimeout(timer);
    }
  }
  pendingInactiveRoomLeaves.clear();

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
