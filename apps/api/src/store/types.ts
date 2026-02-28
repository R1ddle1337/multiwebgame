import type {
  BlockDTO,
  GameType,
  InviteLinkDTO,
  InvitationDTO,
  MatchDTO,
  RatingFormulaDTO,
  RatingDTO,
  ReportDTO,
  RoomDTO,
  RoomPlayerRole,
  SessionDTO,
  UserDTO
} from '@multiwebgame/shared-types';

export class StoreError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'conflict'
      | 'forbidden'
      | 'validation_error'
      | 'unauthorized'
      | 'capacity_reached'
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

export interface Store {
  createGuestUser(displayName: string): Promise<UserDTO>;
  createRegisteredUser(params: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDTO>;
  upgradeGuestUser(params: {
    userId: string;
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDTO>;
  findUserByEmail(email: string): Promise<{ user: UserDTO; passwordHash: string } | null>;
  getUserById(userId: string): Promise<UserDTO | null>;
  createSession(userId: string): Promise<SessionDTO>;
  getSessionById(sessionId: string): Promise<SessionDTO | null>;
  deleteSession(sessionId: string): Promise<void>;
  listRatingFormulas(): Promise<RatingFormulaDTO[]>;
  listOpenRooms(): Promise<RoomDTO[]>;
  getRoomById(roomId: string): Promise<RoomDTO | null>;
  createRoom(hostUserId: string, gameType: GameType, maxPlayers?: number): Promise<RoomDTO>;
  joinRoom(roomId: string, userId: string, asSpectator?: boolean): Promise<RoomDTO>;
  leaveRoom(roomId: string, userId: string): Promise<RoomDTO | null>;
  createOrGetInviteLink(params: { roomId: string; createdByUserId: string }): Promise<InviteLinkDTO>;
  acceptInviteLink(params: {
    token: string;
    userId: string;
  }): Promise<{ room: RoomDTO; role: RoomPlayerRole }>;
  createInvitation(params: { roomId: string; fromUserId: string; toUserId: string }): Promise<InvitationDTO>;
  listInvitationsForUser(userId: string): Promise<InvitationDTO[]>;
  respondInvitation(params: {
    invitationId: string;
    userId: string;
    action: 'accept' | 'decline';
  }): Promise<InvitationDTO>;
  listMatchHistoryForUser(userId: string, limit: number): Promise<MatchDTO[]>;
  getMatchById(matchId: string): Promise<MatchDTO | null>;
  listRatingsForUser(userId: string): Promise<RatingDTO[]>;
  listBlockedUsers(userId: string): Promise<BlockDTO[]>;
  blockUser(params: {
    blockerUserId: string;
    blockedUserId: string;
    reason?: string | null;
  }): Promise<BlockDTO>;
  reportUser(params: {
    reporterUserId: string;
    targetUserId?: string | null;
    matchId?: string | null;
    reason: string;
    details?: string | null;
  }): Promise<void>;
  listReports(params: { status?: ReportDTO['status']; limit: number }): Promise<ReportDTO[]>;
  resolveReport(params: {
    reportId: string;
    status: Exclude<ReportDTO['status'], 'open'>;
  }): Promise<ReportDTO>;
}
