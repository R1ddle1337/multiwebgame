import type {
  BlockDTO,
  GameType,
  InvitationDTO,
  MatchDTO,
  RatingDTO,
  RoomDTO,
  SessionDTO,
  UserDTO
} from '@multiwebgame/shared-types';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { Store } from '../src/store/types.js';

class InMemoryStore implements Store {
  private users = new Map<string, UserDTO>();

  private userPasswords = new Map<string, { email: string; passwordHash: string }>();

  private sessions = new Map<string, SessionDTO>();

  private rooms = new Map<string, RoomDTO>();

  private invitations = new Map<string, InvitationDTO>();

  private matches = new Map<string, MatchDTO>();

  private blocks = new Map<string, BlockDTO>();

  private reports: Array<{
    reporterUserId: string;
    targetUserId?: string | null;
    matchId?: string | null;
    reason: string;
    details?: string | null;
  }> = [];

  private defaultRatings(): Record<GameType, number> {
    return {
      single_2048: 1200,
      gomoku: 1200,
      xiangqi: 1200,
      go: 1200
    };
  }

  async createGuestUser(displayName: string): Promise<UserDTO> {
    const user: UserDTO = {
      id: randomUUID(),
      displayName,
      isGuest: true,
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

    const alreadyInRoom = room.players.some((player) => player.userId === userId);
    if (alreadyInRoom) {
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('capacity');
    }

    const playerSlots = room.gameType === 'single_2048' ? 1 : 2;
    const activePlayers = room.players.filter((player) => player.role === 'player');
    const role = !asSpectator && activePlayers.length < playerSlots ? 'player' : 'spectator';

    room.players.push({
      id: randomUUID(),
      roomId,
      userId,
      role,
      seat: role === 'player' ? activePlayers.length + 1 : null,
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

    if (room.hostUserId === userId) {
      room.hostUserId = room.players[0].userId;
    }

    this.rooms.set(roomId, room);
    return room;
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
    this.reports.push(params);
  }
}

describe('critical API routes', () => {
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
});
