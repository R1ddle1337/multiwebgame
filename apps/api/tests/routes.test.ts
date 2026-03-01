import type {
  BlockDTO,
  GameType,
  InviteLinkDTO,
  InvitationDTO,
  MatchDTO,
  RatingDTO,
  RatingFormulaDTO,
  ReportDTO,
  RoomDTO,
  RoomPlayerRole,
  SessionDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import { randomUUID } from 'crypto';
import net from 'node:net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { StoreError, type Store } from '../src/store/types.js';

const canBindTcpPort = await new Promise<boolean>((resolve) => {
  const server = net.createServer();
  server.once('error', () => resolve(false));
  server.listen(0, '127.0.0.1', () => {
    server.close(() => resolve(true));
  });
});
const describeIfTcpAvailable = canBindTcpPort ? describe : describe.skip;

class InMemoryStore implements Store {
  private users = new Map<string, UserDTO>();

  private userPasswords = new Map<string, { email: string; passwordHash: string }>();

  private sessions = new Map<string, SessionDTO>();

  private rooms = new Map<string, RoomDTO>();

  private invitations = new Map<string, InvitationDTO>();

  private inviteLinks = new Map<string, InviteLinkDTO>();

  private matches = new Map<string, MatchDTO>();

  private blocks = new Map<string, BlockDTO>();

  private reports = new Map<string, ReportDTO>();

  setRoomStatus(roomId: string, status: RoomDTO['status']): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    room.status = status;
    this.rooms.set(roomId, room);
  }

  setRoomPlayers(roomId: string, players: RoomDTO['players']): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      return;
    }
    room.players = players;
    this.rooms.set(roomId, room);
  }

  private defaultRatings(): Record<GameType, number> {
    return {
      single_2048: 1200,
      gomoku: 1200,
      santorini: 1200,
      onitama: 1200,
      battleship: 1200,
      love_letter: 1200,
      codenames_duet: 1200,
      xiangqi: 1200,
      go: 1200,
      connect4: 1200,
      reversi: 1200,
      dots: 1200,
      backgammon: 1200,
      cards: 1200,
      quoridor: 1200,
      hex: 1200,
      liars_dice: 1200
    };
  }

  async createGuestUser(displayName: string): Promise<UserDTO> {
    const user: UserDTO = {
      id: randomUUID(),
      displayName,
      isGuest: true,
      isAdmin: /admin/i.test(displayName),
      rating: 1200,
      ratings: this.defaultRatings(),
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    return user;
  }

  async createRegisteredUser(params: {
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDTO> {
    const existing = Array.from(this.userPasswords.values()).find(
      (entry) => entry.email === params.email.toLowerCase()
    );
    if (existing) {
      throw new Error('email_exists');
    }

    const user: UserDTO = {
      id: randomUUID(),
      displayName: params.displayName,
      isGuest: false,
      isAdmin: /admin/i.test(params.displayName),
      rating: 1200,
      ratings: this.defaultRatings(),
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    this.userPasswords.set(user.id, { email: params.email.toLowerCase(), passwordHash: params.passwordHash });
    return user;
  }

  async upgradeGuestUser(params: {
    userId: string;
    displayName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserDTO> {
    const user = this.users.get(params.userId);
    if (!user || !user.isGuest) {
      throw new Error('not_guest');
    }

    user.isGuest = false;
    user.displayName = params.displayName;
    this.users.set(user.id, user);
    this.userPasswords.set(user.id, { email: params.email.toLowerCase(), passwordHash: params.passwordHash });
    return user;
  }

  async findUserByEmail(email: string): Promise<{ user: UserDTO; passwordHash: string } | null> {
    const entry = Array.from(this.userPasswords.entries()).find(
      ([, data]) => data.email === email.toLowerCase()
    );
    if (!entry) {
      return null;
    }

    const [userId, data] = entry;
    const user = this.users.get(userId)!;
    return { user, passwordHash: data.passwordHash };
  }

  async getUserById(userId: string): Promise<UserDTO | null> {
    return this.users.get(userId) ?? null;
  }

  async createSession(userId: string): Promise<SessionDTO> {
    const session: SessionDTO = {
      id: randomUUID(),
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSessionById(sessionId: string): Promise<SessionDTO | null> {
    const session = this.sessions.get(sessionId);
    return session ?? null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listRatingFormulas(): Promise<RatingFormulaDTO[]> {
    return (
      [
        'single_2048',
        'gomoku',
        'santorini',
        'onitama',
        'battleship',
        'love_letter',
        'codenames_duet',
        'xiangqi',
        'go',
        'connect4',
        'reversi',
        'dots',
        'backgammon',
        'cards',
        'quoridor',
        'hex',
        'liars_dice'
      ] as const
    ).map((gameType) => ({
      gameType,
      system: 'elo',
      initialRating: 1200,
      kFactor: 24,
      expectedScore: '1 / (1 + 10^((opponent - player) / 400))'
    }));
  }

  async listOpenRooms(): Promise<RoomDTO[]> {
    return Array.from(this.rooms.values()).filter((room) => room.status !== 'closed');
  }

  async getRoomById(roomId: string): Promise<RoomDTO | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async createRoom(hostUserId: string, gameType: GameType, maxPlayers?: number): Promise<RoomDTO> {
    const host = this.users.get(hostUserId);
    if (!host) {
      throw new Error('host_not_found');
    }

    const room: RoomDTO = {
      id: randomUUID(),
      hostUserId,
      gameType,
      status: 'open',
      maxPlayers: maxPlayers ?? (gameType === 'single_2048' ? 1 : 4),
      createdAt: new Date().toISOString(),
      players: [
        {
          id: randomUUID(),
          roomId: '',
          userId: hostUserId,
          role: 'player',
          seat: 1,
          joinedAt: new Date().toISOString(),
          leftAt: null,
          user: host
        }
      ]
    };
    room.players[0].roomId = room.id;
    this.rooms.set(room.id, room);
    return room;
  }

  async joinRoom(roomId: string, userId: string, asSpectator = false): Promise<RoomDTO> {
    const room = this.rooms.get(roomId);
    const user = this.users.get(userId);
    if (!room || !user) {
      throw new Error('room_or_user_not_found');
    }

    const playerSlots = room.gameType === 'single_2048' ? 1 : 2;
    const activePlayers = room.players.filter((player) => player.role === 'player');
    const existing = room.players.find((player) => player.userId === userId);
    if (existing) {
      if (existing.role === 'spectator' && !asSpectator && activePlayers.length < playerSlots) {
        const usedSeats = new Set(
          activePlayers
            .map((player) => player.seat)
            .filter((seat): seat is number => typeof seat === 'number')
        );
        let nextSeat = 1;
        while (usedSeats.has(nextSeat) && nextSeat <= playerSlots) {
          nextSeat += 1;
        }

        existing.role = 'player';
        existing.seat = nextSeat;
        this.rooms.set(roomId, room);
      }
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new StoreError('Room capacity reached', 'capacity_reached');
    }

    const role = !asSpectator && activePlayers.length < playerSlots ? 'player' : 'spectator';
    const usedSeats = new Set(
      activePlayers.map((player) => player.seat).filter((seat): seat is number => typeof seat === 'number')
    );
    let nextSeat = 1;
    while (usedSeats.has(nextSeat) && nextSeat <= playerSlots) {
      nextSeat += 1;
    }

    room.players.push({
      id: randomUUID(),
      roomId,
      userId,
      role,
      seat: role === 'player' ? nextSeat : null,
      joinedAt: new Date().toISOString(),
      leftAt: null,
      user
    });

    this.rooms.set(roomId, room);
    return room;
  }

  async leaveRoom(roomId: string, userId: string): Promise<RoomDTO | null> {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    room.players = room.players.filter((player) => player.userId !== userId);
    if (room.players.length === 0) {
      room.status = 'closed';
      this.rooms.set(roomId, room);
      return null;
    }

    const activePlayers = room.players.filter((player) => player.role === 'player');
    const requiredPlayers = room.gameType === 'single_2048' ? 1 : 2;

    if (activePlayers.length < requiredPlayers) {
      room.status = 'open';
    }

    if (room.hostUserId === userId) {
      room.hostUserId = activePlayers[0]?.userId ?? room.players[0].userId;
    }

    this.rooms.set(roomId, room);
    return room;
  }

  async createOrGetInviteLink(params: { roomId: string; createdByUserId: string }): Promise<InviteLinkDTO> {
    const room = this.rooms.get(params.roomId);
    if (!room) {
      throw new StoreError('Room not found', 'not_found');
    }
    if (room.status === 'closed') {
      throw new StoreError('Room is closed', 'forbidden');
    }
    if (room.hostUserId !== params.createdByUserId) {
      throw new StoreError('Only room host can create invite links', 'forbidden');
    }

    const existing = Array.from(this.inviteLinks.values()).find(
      (link) => link.roomId === params.roomId && !link.invalidatedAt
    );
    if (existing) {
      return existing;
    }

    const activeMatch = Array.from(this.matches.values()).find(
      (match) => match.roomId === params.roomId && match.status === 'active'
    );

    const link: InviteLinkDTO = {
      id: randomUUID(),
      roomId: params.roomId,
      token: randomUUID().replace(/-/g, ''),
      createdByUserId: params.createdByUserId,
      matchId: activeMatch?.id ?? null,
      createdAt: new Date().toISOString(),
      invalidatedAt: null,
      invalidatedReason: null
    };
    this.inviteLinks.set(link.token, link);
    return link;
  }

  async acceptInviteLink(params: {
    token: string;
    userId: string;
  }): Promise<{ room: RoomDTO; role: RoomPlayerRole }> {
    const link = this.inviteLinks.get(params.token);
    if (!link || link.invalidatedAt) {
      throw new StoreError('invite_invalid', 'validation_error');
    }

    const room = this.rooms.get(link.roomId);
    if (!room || room.status === 'closed') {
      link.invalidatedAt = new Date().toISOString();
      link.invalidatedReason = 'room_closed';
      this.inviteLinks.set(link.token, link);
      throw new StoreError('invite_invalid', 'validation_error');
    }

    if (link.matchId) {
      const match = this.matches.get(link.matchId);
      if (!match || match.status !== 'active') {
        link.invalidatedAt = new Date().toISOString();
        link.invalidatedReason = 'match_ended';
        this.inviteLinks.set(link.token, link);
        throw new StoreError('invite_invalid', 'validation_error');
      }
    }

    const playerSlots = room.gameType === 'single_2048' ? 1 : 2;
    const activePlayers = room.players.filter((player) => player.role === 'player').length;
    const joinAsSpectator = activePlayers >= playerSlots;

    const joined = await this.joinRoom(room.id, params.userId, joinAsSpectator);
    const role = joined.players.find((player) => player.userId === params.userId)?.role ?? 'spectator';
    return { room: joined, role };
  }

  async createInvitation(params: {
    roomId: string;
    fromUserId: string;
    toUserId: string;
  }): Promise<InvitationDTO> {
    const invitation: InvitationDTO = {
      id: randomUUID(),
      roomId: params.roomId,
      fromUserId: params.fromUserId,
      toUserId: params.toUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null
    };
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async listInvitationsForUser(userId: string): Promise<InvitationDTO[]> {
    return Array.from(this.invitations.values()).filter(
      (invite) => invite.fromUserId === userId || invite.toUserId === userId
    );
  }

  async respondInvitation(params: {
    invitationId: string;
    userId: string;
    action: 'accept' | 'decline';
  }): Promise<InvitationDTO> {
    const invitation = this.invitations.get(params.invitationId);
    if (!invitation || invitation.toUserId !== params.userId) {
      throw new Error('invitation_not_found');
    }

    invitation.status = params.action === 'accept' ? 'accepted' : 'declined';
    invitation.respondedAt = new Date().toISOString();
    this.invitations.set(invitation.id, invitation);
    return invitation;
  }

  async listMatchHistoryForUser(userId: string, limit: number): Promise<MatchDTO[]> {
    return Array.from(this.matches.values())
      .filter((match) => {
        const room = this.rooms.get(match.roomId);
        return room ? room.players.some((player) => player.userId === userId) : false;
      })
      .slice(0, limit);
  }

  async getMatchById(matchId: string): Promise<MatchDTO | null> {
    return this.matches.get(matchId) ?? null;
  }

  async listRatingsForUser(userId: string): Promise<RatingDTO[]> {
    const user = this.users.get(userId);
    if (!user) {
      return [];
    }

    return (Object.keys(user.ratings) as GameType[]).map((gameType) => ({
      gameType,
      rating: user.ratings[gameType] ?? 1200,
      updatedAt: new Date().toISOString()
    }));
  }

  async listBlockedUsers(userId: string): Promise<BlockDTO[]> {
    return Array.from(this.blocks.values()).filter((block) => block.blockerUserId === userId);
  }

  async blockUser(params: {
    blockerUserId: string;
    blockedUserId: string;
    reason?: string | null;
  }): Promise<BlockDTO> {
    const block: BlockDTO = {
      id: randomUUID(),
      blockerUserId: params.blockerUserId,
      blockedUserId: params.blockedUserId,
      reason: params.reason ?? null,
      createdAt: new Date().toISOString()
    };

    this.blocks.set(`${params.blockerUserId}:${params.blockedUserId}`, block);
    return block;
  }

  async reportUser(params: {
    reporterUserId: string;
    targetUserId?: string | null;
    matchId?: string | null;
    reason: string;
    details?: string | null;
  }): Promise<void> {
    const report: ReportDTO = {
      id: randomUUID(),
      reporterUserId: params.reporterUserId,
      targetUserId: params.targetUserId ?? null,
      matchId: params.matchId ?? null,
      reason: params.reason,
      details: params.details ?? null,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.reports.set(report.id, report);
  }

  async listReports(params: { status?: ReportDTO['status']; limit: number }): Promise<ReportDTO[]> {
    return Array.from(this.reports.values())
      .filter((report) => (params.status ? report.status === params.status : true))
      .slice(0, params.limit);
  }

  async resolveReport(params: {
    reportId: string;
    status: Exclude<ReportDTO['status'], 'open'>;
  }): Promise<ReportDTO> {
    const report = this.reports.get(params.reportId);
    if (!report) {
      throw new Error('report_not_found');
    }

    report.status = params.status;
    report.updatedAt = new Date().toISOString();
    this.reports.set(report.id, report);
    return report;
  }
}

class SessionLookupFailingStore extends InMemoryStore {
  async getSessionById(_sessionId: string): Promise<SessionDTO | null> {
    throw new Error('session_lookup_failure');
  }
}

describeIfTcpAvailable('critical API routes', () => {
  it('creates a guest account and resolves /me', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const auth = await request(app).post('/auth/guest').send({ displayName: 'Alice' }).expect(201);
    expect(auth.body.token).toBeTypeOf('string');
    expect(auth.body.user.displayName).toBe('Alice');

    const me = await request(app).get('/me').set('Authorization', `Bearer ${auth.body.token}`).expect(200);
    expect(me.body.user.id).toBe(auth.body.user.id);
    expect(me.body.session.id).toBe(auth.body.session.id);
    expect(me.body.user.ratings.gomoku).toBe(1200);
    expect(me.body.user.isAdmin).toBe(false);
  });

  it('upgrades guest account with credentials', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const auth = await request(app).post('/auth/guest').send({ displayName: 'Temp' }).expect(201);

    const upgraded = await request(app)
      .post('/auth/upgrade')
      .set('Authorization', `Bearer ${auth.body.token}`)
      .send({
        displayName: 'Alice Pro',
        email: 'alice@example.com',
        password: 'changeme123'
      })
      .expect(200);

    expect(upgraded.body.user.isGuest).toBe(false);
    expect(upgraded.body.user.displayName).toBe('Alice Pro');

    const login = await request(app)
      .post('/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'changeme123'
      })
      .expect(200);

    expect(login.body.user.displayName).toBe('Alice Pro');
  });

  it('supports room spectator joins', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const watcher = await request(app).post('/auth/guest').send({ displayName: 'Watcher' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    const joined = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${watcher.body.token}`)
      .send({ asSpectator: true })
      .expect(200);

    const watcherRow = joined.body.room.players.find(
      (player: { userId: string }) => player.userId === watcher.body.user.id
    );
    expect(watcherRow.role).toBe('spectator');
    expect(watcherRow.seat).toBeNull();
  });

  it('creates reusable invite links and auto-assigns player then spectator', async () => {
    const store = new InMemoryStore();
    const app = createApp(store, { webOrigin: 'http://localhost:5173' });

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const firstJoiner = await request(app).post('/auth/guest').send({ displayName: 'Joiner1' }).expect(201);
    const secondJoiner = await request(app).post('/auth/guest').send({ displayName: 'Joiner2' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    const inviteA = await request(app)
      .post(`/rooms/${room.body.room.id}/invite-link`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    const inviteB = await request(app)
      .post(`/rooms/${room.body.room.id}/invite-link`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    expect(inviteA.body.token).toBe(inviteB.body.token);
    expect(inviteA.body.url).toBe(`http://localhost:5173/invite/${inviteA.body.token}`);

    const acceptedPlayer = await request(app)
      .post(`/invite-links/${inviteA.body.token}/accept`)
      .set('Authorization', `Bearer ${firstJoiner.body.token}`)
      .send({})
      .expect(200);
    expect(acceptedPlayer.body.role).toBe('player');

    const acceptedSpectator = await request(app)
      .post(`/invite-links/${inviteA.body.token}/accept`)
      .set('Authorization', `Bearer ${secondJoiner.body.token}`)
      .send({})
      .expect(200);
    expect(acceptedSpectator.body.role).toBe('spectator');
  });

  it('defaults invite-link join to player when seats are available', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const watcher = await request(app).post('/auth/guest').send({ displayName: 'Watcher' }).expect(201);
    const invited = await request(app).post('/auth/guest').send({ displayName: 'Invited' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'single_2048', maxPlayers: 4 })
      .expect(201);

    const invite = await request(app)
      .post(`/rooms/${room.body.room.id}/invite-link`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${watcher.body.token}`)
      .send({ asSpectator: true })
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    const accepted = await request(app)
      .post(`/invite-links/${invite.body.token}/accept`)
      .set('Authorization', `Bearer ${invited.body.token}`)
      .send({})
      .expect(200);

    expect(accepted.body.role).toBe('player');
  });

  it('rejects invite-link creation for non-host users', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const member = await request(app).post('/auth/guest').send({ displayName: 'Member' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'go', maxPlayers: 4 })
      .expect(201);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${member.body.token}`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/invite-link`)
      .set('Authorization', `Bearer ${member.body.token}`)
      .send({})
      .expect(403);
  });

  it('returns invite_invalid when invite-link target room is closed', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const guest = await request(app).post('/auth/guest').send({ displayName: 'Guest' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    const invite = await request(app)
      .post(`/rooms/${room.body.room.id}/invite-link`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    const invalid = await request(app)
      .post(`/invite-links/${invite.body.token}/accept`)
      .set('Authorization', `Bearer ${guest.body.token}`)
      .send({})
      .expect(400);

    expect(invalid.body.error).toBe('invite_invalid');
  });

  it('promotes an existing spectator to player when a seat opens', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const player2 = await request(app).post('/auth/guest').send({ displayName: 'Player2' }).expect(201);
    const watcher = await request(app).post('/auth/guest').send({ displayName: 'Watcher' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'xiangqi', maxPlayers: 4 })
      .expect(201);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${player2.body.token}`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${watcher.body.token}`)
      .send({ asSpectator: true })
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${player2.body.token}`)
      .send({})
      .expect(200);

    const promoted = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${watcher.body.token}`)
      .send({ asSpectator: false })
      .expect(200);

    const watcherRow = promoted.body.room.players.find(
      (player: { userId: string }) => player.userId === watcher.body.user.id
    );
    expect(watcherRow.role).toBe('player');
    expect(watcherRow.seat).toBe(2);
  });

  it('enforces room capacity and seat role semantics for 4-player rooms', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const p2 = await request(app).post('/auth/guest').send({ displayName: 'P2' }).expect(201);
    const s1 = await request(app).post('/auth/guest').send({ displayName: 'S1' }).expect(201);
    const s2 = await request(app).post('/auth/guest').send({ displayName: 'S2' }).expect(201);
    const overflow = await request(app).post('/auth/guest').send({ displayName: 'Overflow' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    const joinP2 = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${p2.body.token}`)
      .send({})
      .expect(200);

    const joinS1 = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${s1.body.token}`)
      .send({})
      .expect(200);

    const joinS2 = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${s2.body.token}`)
      .send({})
      .expect(200);

    const p2Row = joinP2.body.room.players.find(
      (player: { userId: string }) => player.userId === p2.body.user.id
    );
    const s1Row = joinS1.body.room.players.find(
      (player: { userId: string }) => player.userId === s1.body.user.id
    );
    const s2Row = joinS2.body.room.players.find(
      (player: { userId: string }) => player.userId === s2.body.user.id
    );

    expect(p2Row.role).toBe('player');
    expect(p2Row.seat).toBe(2);
    expect(s1Row.role).toBe('spectator');
    expect(s2Row.role).toBe('spectator');

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${overflow.body.token}`)
      .send({})
      .expect(409);
  });

  it('transfers ownership when creator leaves and keeps room interactive', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const player2 = await request(app).post('/auth/guest').send({ displayName: 'Player2' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${player2.body.token}`)
      .send({})
      .expect(200);

    const left = await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    expect(left.body.room.hostUserId).toBe(player2.body.user.id);
    expect(left.body.room.status).toBe('open');
    expect(
      left.body.room.players.some((player: { userId: string }) => player.userId === host.body.user.id)
    ).toBe(false);
  });

  it('abandons impossible in-match room state and allows slot replacement', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const player2 = await request(app).post('/auth/guest').send({ displayName: 'Player2' }).expect(201);
    const replacement = await request(app)
      .post('/auth/guest')
      .send({ displayName: 'Replacement' })
      .expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'xiangqi', maxPlayers: 4 })
      .expect(201);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${player2.body.token}`)
      .send({})
      .expect(200);

    store.setRoomStatus(room.body.room.id, 'in_match');

    const afterLeave = await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${player2.body.token}`)
      .send({})
      .expect(200);

    expect(afterLeave.body.room.status).toBe('open');

    const joinedReplacement = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${replacement.body.token}`)
      .send({})
      .expect(200);

    const replacementRow = joinedReplacement.body.room.players.find(
      (player: { userId: string }) => player.userId === replacement.body.user.id
    );
    expect(replacementRow.role).toBe('player');
    expect(replacementRow.seat).toBe(2);
  });

  it('restores player control when the same user re-joins after a transient leave', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const player = await request(app).post('/auth/guest').send({ displayName: 'Player' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'go', maxPlayers: 4 })
      .expect(201);

    await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${player.body.token}`)
      .send({})
      .expect(200);

    await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${player.body.token}`)
      .send({})
      .expect(200);

    const rejoined = await request(app)
      .post(`/rooms/${room.body.room.id}/join`)
      .set('Authorization', `Bearer ${player.body.token}`)
      .send({})
      .expect(200);

    const playerRow = rejoined.body.room.players.find(
      (member: { userId: string }) => member.userId === player.body.user.id
    );
    expect(playerRow.role).toBe('player');
    expect(playerRow.seat).toBe(2);
  });

  it('closes and cleans up empty rooms when the last participant leaves', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    const leave = await request(app)
      .post(`/rooms/${room.body.room.id}/leave`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({})
      .expect(200);

    expect(leave.body.room).toBeNull();

    const list = await request(app)
      .get('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .expect(200);
    expect(list.body.rooms.some((entry: { id: string }) => entry.id === room.body.room.id)).toBe(false);
  });

  it('exposes rating formulas', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const response = await request(app).get('/ratings/formula').expect(200);

    expect(response.body.formulas).toHaveLength(8);
    expect(response.body.formulas[0].system).toBe('elo');
  });

  it('supports block + report moderation endpoints', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const reporter = await request(app).post('/auth/guest').send({ displayName: 'Reporter' }).expect(201);
    const target = await request(app).post('/auth/guest').send({ displayName: 'Target' }).expect(201);

    const block = await request(app)
      .post('/moderation/blocks')
      .set('Authorization', `Bearer ${reporter.body.token}`)
      .send({
        userId: target.body.user.id,
        reason: 'spam invites'
      })
      .expect(201);

    expect(block.body.block.blockedUserId).toBe(target.body.user.id);

    const list = await request(app)
      .get('/moderation/blocks')
      .set('Authorization', `Bearer ${reporter.body.token}`)
      .expect(200);

    expect(list.body.blocks).toHaveLength(1);

    await request(app)
      .post('/moderation/reports')
      .set('Authorization', `Bearer ${reporter.body.token}`)
      .send({
        targetUserId: target.body.user.id,
        reason: 'abusive behavior'
      })
      .expect(201);
  });

  it('supports admin report triage workflow', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const admin = await request(app).post('/auth/guest').send({ displayName: 'Admin Root' }).expect(201);
    const reporter = await request(app).post('/auth/guest').send({ displayName: 'Reporter' }).expect(201);
    const target = await request(app).post('/auth/guest').send({ displayName: 'Target' }).expect(201);

    await request(app)
      .post('/moderation/reports')
      .set('Authorization', `Bearer ${reporter.body.token}`)
      .send({
        targetUserId: target.body.user.id,
        reason: 'game abuse'
      })
      .expect(201);

    await request(app)
      .get('/moderation/reports')
      .set('Authorization', `Bearer ${reporter.body.token}`)
      .expect(403);

    const listed = await request(app)
      .get('/moderation/reports?status=open&limit=10')
      .set('Authorization', `Bearer ${admin.body.token}`)
      .expect(200);

    expect(listed.body.reports).toHaveLength(1);

    const reportId = listed.body.reports[0].id as string;
    const resolved = await request(app)
      .patch(`/moderation/reports/${reportId}`)
      .set('Authorization', `Bearer ${admin.body.token}`)
      .send({ status: 'resolved' })
      .expect(200);

    expect(resolved.body.report.status).toBe('resolved');
  });

  it('accepts bearer token with flexible whitespace', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);
    const auth = await request(app).post('/auth/guest').send({ displayName: 'Alice' }).expect(201);

    await request(app).get('/me').set('Authorization', `Bearer    ${auth.body.token}`).expect(200);
  });

  it('returns 500 for internal session lookup failures instead of masking as auth errors', async () => {
    const store = new SessionLookupFailingStore();
    const app = createApp(store);
    const auth = await request(app).post('/auth/guest').send({ displayName: 'Alice' }).expect(201);

    const me = await request(app).get('/me').set('Authorization', `Bearer ${auth.body.token}`).expect(500);
    expect(me.body.error).toBe('Internal server error');
  });

  it('returns JSON error for malformed JSON payloads', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const response = await request(app)
      .post('/auth/guest')
      .set('Content-Type', 'application/json')
      .send('{"displayName":')
      .expect(400);

    expect(response.body.error).toBe('Invalid JSON body');
  });

  it('returns JSON 404 payload for unknown routes', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const response = await request(app).get('/unknown/route').expect(404);
    expect(response.body.error).toBe('Not found');
  });

  it('enforces explicit CORS allow-list', async () => {
    const store = new InMemoryStore();
    const app = createApp(store, { webOrigin: 'http://allowed.local, http://other.local' });

    await request(app)
      .get('/health')
      .set('Origin', 'http://allowed.local')
      .expect('Access-Control-Allow-Origin', 'http://allowed.local')
      .expect(200);

    const blocked = await request(app).get('/health').set('Origin', 'http://blocked.local').expect(403);
    expect(blocked.body.error).toBe('CORS origin denied');
  });

  it('filters stale rooms with empty player rosters from lobby payloads', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);
    const host = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .send({ gameType: 'gomoku', maxPlayers: 4 })
      .expect(201);

    store.setRoomPlayers(room.body.room.id, []);

    const list = await request(app)
      .get('/rooms')
      .set('Authorization', `Bearer ${host.body.token}`)
      .expect(200);
    expect(list.body.rooms).toEqual([]);

    await request(app)
      .get(`/rooms/${room.body.room.id}`)
      .set('Authorization', `Bearer ${host.body.token}`)
      .expect(404);
  });
});
