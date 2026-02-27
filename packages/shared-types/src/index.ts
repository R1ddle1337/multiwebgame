export type GameType = 'single_2048' | 'gomoku';

export interface UserDTO {
  id: string;
  displayName: string;
  isGuest: boolean;
  rating: number;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface RoomPlayerDTO {
  id: string;
  roomId: string;
  userId: string;
  seat: number;
  joinedAt: string;
  leftAt: string | null;
  user: UserDTO;
}

export interface RoomDTO {
  id: string;
  hostUserId: string;
  gameType: GameType;
  status: 'open' | 'in_match' | 'closed';
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
  startedAt: string;
  endedAt: string | null;
  moves: MatchMoveDTO[];
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

export type ClientToServerMessage =
  | WsEnvelope<'auth', { token: string; reconnectKey?: string }>
  | WsEnvelope<'lobby.subscribe', {}>
  | WsEnvelope<'room.subscribe', { roomId: string }>
  | WsEnvelope<'room.move', { roomId: string; x: number; y: number }>
  | WsEnvelope<'matchmaking.join', { gameType: 'gomoku' }>
  | WsEnvelope<'matchmaking.leave', {}>
  | WsEnvelope<'invite.respond', { invitationId: string; action: 'accept' | 'decline' }>
  | WsEnvelope<'ping', { ts: number }>;

export type ServerToClientMessage =
  | WsEnvelope<'auth.ok', { connectionId: string; reconnectKey: string; user: UserDTO }>
  | WsEnvelope<'auth.error', { reason: string }>
  | WsEnvelope<'lobby.presence', { onlineUsers: Array<{ userId: string; displayName: string }> }>
  | WsEnvelope<'room.state', { room: RoomDTO; gomokuState: GomokuState | null }>
  | WsEnvelope<'room.player_joined', { roomId: string; user: UserDTO }>
  | WsEnvelope<'room.player_left', { roomId: string; userId: string }>
  | WsEnvelope<'invite.received', { invitation: InvitationDTO }>
  | WsEnvelope<'invite.updated', { invitationId: string; status: InvitationDTO['status'] }>
  | WsEnvelope<'matchmaking.queued', { queueSize: number }>
  | WsEnvelope<'matchmaking.matched', { room: RoomDTO; matchId: string }>
  | WsEnvelope<'match.move_applied', { roomId: string; state: GomokuState; lastMove: GomokuMove }>
  | WsEnvelope<'error', { reason: string }>
  | WsEnvelope<'pong', { ts: number }>;
