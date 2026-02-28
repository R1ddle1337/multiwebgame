export type GameType = 'single_2048' | 'gomoku' | 'xiangqi' | 'go' | 'connect4' | 'reversi';
export type BoardGameType = 'gomoku' | 'xiangqi' | 'go' | 'connect4' | 'reversi';

export interface UserDTO {
  id: string;
  displayName: string;
  isGuest: boolean;
  isAdmin: boolean;
  rating: number;
  ratings: Partial<Record<GameType, number>>;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export type RoomPlayerRole = 'player' | 'spectator';

export interface RoomPlayerDTO {
  id: string;
  roomId: string;
  userId: string;
  role: RoomPlayerRole;
  seat: number | null;
  joinedAt: string;
  leftAt: string | null;
  user: UserDTO;
}

export interface RoomDTO {
  id: string;
  hostUserId: string;
  gameType: GameType;
  status: 'open' | 'in_match' | 'closed';
  maxPlayers: number;
  createdAt: string;
  players: RoomPlayerDTO[];
}

export interface InvitationDTO {
  id: string;
  roomId: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  respondedAt: string | null;
}

export interface InviteLinkDTO {
  id: string;
  roomId: string;
  token: string;
  createdByUserId: string | null;
  matchId: string | null;
  createdAt: string;
  invalidatedAt: string | null;
  invalidatedReason: string | null;
}

export interface MatchMoveDTO {
  id: string;
  matchId: string;
  moveIndex: number;
  actorUserId: string;
  moveType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MatchDTO {
  id: string;
  roomId: string;
  gameType: GameType;
  status: 'active' | 'completed' | 'abandoned';
  winnerUserId: string | null;
  resultPayload: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
  moves: MatchMoveDTO[];
}

export interface RatingDTO {
  gameType: GameType;
  rating: number;
  updatedAt: string;
}

export interface RatingFormulaDTO {
  gameType: GameType;
  system: 'elo';
  initialRating: number;
  kFactor: number;
  expectedScore: '1 / (1 + 10^((opponent - player) / 400))';
}

export interface BlockDTO {
  id: string;
  blockerUserId: string;
  blockedUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface ReportDTO {
  id: string;
  reporterUserId: string;
  targetUserId: string | null;
  matchId: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export interface ApiError {
  error: string;
}

export interface AuthResponse {
  token: string;
  user: UserDTO;
  session: SessionDTO;
}

export type GomokuMark = 'black' | 'white';
export type GomokuRuleset = 'freestyle' | 'renju';
export type GomokuForbiddenMoveReason = 'overline' | 'double_three' | 'double_four';

export interface GomokuMove {
  x: number;
  y: number;
  player: GomokuMark;
}

export interface GomokuState {
  boardSize: number;
  board: (GomokuMark | null)[][];
  nextPlayer: GomokuMark;
  winner: GomokuMark | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
  ruleset: GomokuRuleset;
  forbiddenMove: GomokuForbiddenMoveReason | null;
}

export type Connect4Disc = 'red' | 'yellow';

export interface Connect4Move {
  column: number;
  player: Connect4Disc;
}

export interface Connect4State {
  columns: number;
  rows: number;
  board: (Connect4Disc | null)[][];
  nextPlayer: Connect4Disc;
  winner: Connect4Disc | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
}

export type ReversiDisc = 'black' | 'white';

export interface ReversiMove {
  x: number;
  y: number;
  player: ReversiDisc;
}

export interface ReversiState {
  boardSize: number;
  board: (ReversiDisc | null)[][];
  nextPlayer: ReversiDisc;
  winner: ReversiDisc | null;
  status: 'playing' | 'draw' | 'completed';
  moveCount: number;
  counts: {
    black: number;
    white: number;
  };
}

export type GoStone = 'black' | 'white';
export type GoRuleset = 'chinese';

export interface GoPoint {
  x: number;
  y: number;
}

export type GoMove =
  | {
      type: 'place';
      x: number;
      y: number;
      player: GoStone;
    }
  | {
      type: 'pass';
      player: GoStone;
    };

export interface GoScoreBreakdown {
  ruleset: GoRuleset;
  komi: number;
  black: {
    stones: number;
    territory: number;
    captures: number;
    total: number;
  };
  white: {
    stones: number;
    territory: number;
    captures: number;
    komi: number;
    total: number;
  };
  winner: GoStone | null;
  margin: number;
}

export interface GoState {
  boardSize: number;
  board: (GoStone | null)[][];
  nextPlayer: GoStone;
  status: 'playing' | 'completed';
  winner: GoStone | null;
  moveCount: number;
  consecutivePasses: number;
  koPoint: GoPoint | null;
  ruleset: GoRuleset;
  komi: number;
  captures: {
    black: number;
    white: number;
  };
  scoring: GoScoreBreakdown | null;
}

export type XiangqiColor = 'red' | 'black';

export type XiangqiPieceType =
  | 'general'
  | 'advisor'
  | 'elephant'
  | 'horse'
  | 'chariot'
  | 'cannon'
  | 'soldier';

export interface XiangqiPiece {
  type: XiangqiPieceType;
  color: XiangqiColor;
}

export interface XiangqiPosition {
  x: number;
  y: number;
}

export interface XiangqiMove {
  from: XiangqiPosition;
  to: XiangqiPosition;
  player: XiangqiColor;
}

export type XiangqiOutcomeReason =
  | 'capture_general'
  | 'checkmate'
  | 'stalemate'
  | 'perpetual_check_violation'
  | 'draw_repetition';

export interface XiangqiState {
  board: (XiangqiPiece | null)[][];
  nextPlayer: XiangqiColor;
  status: 'playing' | 'completed';
  winner: XiangqiColor | null;
  outcomeReason: XiangqiOutcomeReason | null;
  moveCount: number;
  positionHistory: string[];
}

export type Direction2048 = 'up' | 'down' | 'left' | 'right';

export interface Game2048State {
  board: number[][];
  score: number;
  status: 'playing' | 'won' | 'lost';
}

export interface WsEnvelope<TType extends string, TPayload> {
  type: TType;
  payload: TPayload;
}

export type RoomStatePayload =
  | {
      room: RoomDTO;
      gameType: 'gomoku';
      state: GomokuState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'connect4';
      state: Connect4State | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'reversi';
      state: ReversiState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'go';
      state: GoState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'xiangqi';
      state: XiangqiState | null;
      viewerRole: RoomPlayerRole;
    }
  | {
      room: RoomDTO;
      gameType: 'single_2048';
      state: null;
      viewerRole: RoomPlayerRole;
    };

export type MatchMoveAppliedPayload =
  | {
      roomId: string;
      gameType: 'gomoku';
      state: GomokuState;
      lastMove: GomokuMove;
    }
  | {
      roomId: string;
      gameType: 'connect4';
      state: Connect4State;
      lastMove: Connect4Move;
    }
  | {
      roomId: string;
      gameType: 'reversi';
      state: ReversiState;
      lastMove: ReversiMove;
    }
  | {
      roomId: string;
      gameType: 'go';
      state: GoState;
      lastMove: GoMove;
    }
  | {
      roomId: string;
      gameType: 'xiangqi';
      state: XiangqiState;
      lastMove: XiangqiMove;
    };

export type ClientToServerMessage =
  | WsEnvelope<'auth', { token: string; reconnectKey?: string }>
  | WsEnvelope<'lobby.subscribe', Record<string, never>>
  | WsEnvelope<'room.subscribe', { roomId: string; asSpectator?: boolean }>
  | WsEnvelope<'room.unsubscribe', { roomId: string }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'gomoku'; x: number; y: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'connect4'; column: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'reversi'; x: number; y: number }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'go'; move: GoMove }>
  | WsEnvelope<'room.move', { roomId: string; gameType: 'xiangqi'; move: XiangqiMove }>
  | WsEnvelope<'matchmaking.join', { gameType: BoardGameType }>
  | WsEnvelope<'matchmaking.leave', Record<string, never>>
  | WsEnvelope<'invite.respond', { invitationId: string; action: 'accept' | 'decline' }>
  | WsEnvelope<'ping', { ts: number }>;

export type ServerToClientMessage =
  | WsEnvelope<'auth.ok', { connectionId: string; reconnectKey: string; user: UserDTO }>
  | WsEnvelope<'auth.error', { reason: string }>
  | WsEnvelope<'lobby.presence', { onlineUsers: Array<{ userId: string; displayName: string }> }>
  | WsEnvelope<'room.state', RoomStatePayload>
  | WsEnvelope<'room.player_joined', { roomId: string; user: UserDTO; role: RoomPlayerRole }>
  | WsEnvelope<'room.player_left', { roomId: string; userId: string }>
  | WsEnvelope<'invite.received', { invitation: InvitationDTO }>
  | WsEnvelope<'invite.updated', { invitationId: string; status: InvitationDTO['status'] }>
  | WsEnvelope<'matchmaking.queued', { gameType: BoardGameType; queueSize: number }>
  | WsEnvelope<'matchmaking.timeout', { gameType: BoardGameType }>
  | WsEnvelope<'matchmaking.matched', { room: RoomDTO; matchId: string }>
  | WsEnvelope<'match.move_applied', MatchMoveAppliedPayload>
  | WsEnvelope<
      'match.completed',
      {
        roomId: string;
        matchId: string;
        winnerUserId: string | null;
        resultPayload?: Record<string, unknown> | null;
      }
    >
  | WsEnvelope<'error', { reason: string }>
  | WsEnvelope<'pong', { ts: number }>;
