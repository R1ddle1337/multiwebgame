import type {
  GameType,
  InvitationDTO,
  MatchDTO,
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

  async createGuestUser(displayName: string): Promise<UserDTO> {
    const user: UserDTO = {
      id: randomUUID(),
      displayName,
      isGuest: true,
      rating: 1200,
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
    const existing = Array.from(this.userPasswords.values()).find((entry) => entry.email === params.email.toLowerCase());
    if (existing) {
      throw new Error('email_exists');
    }

    const user: UserDTO = {
      id: randomUUID(),
      displayName: params.displayName,
      isGuest: false,
      rating: 1200,
      createdAt: new Date().toISOString()
    };
    this.users.set(user.id, user);
    this.userPasswords.set(user.id, { email: params.email.toLowerCase(), passwordHash: params.passwordHash });
    return user;
  }

  async findUserByEmail(email: string): Promise<{ user: UserDTO; passwordHash: string } | null> {
    const entry = Array.from(this.userPasswords.entries()).find(([, data]) => data.email === email.toLowerCase());
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
    return Array.from(this.rooms.values()).filter((room) => room.status === 'open');
  }

  async getRoomById(roomId: string): Promise<RoomDTO | null> {
    return this.rooms.get(roomId) ?? null;
  }

  async createRoom(hostUserId: string, gameType: GameType): Promise<RoomDTO> {
    const host = this.users.get(hostUserId);
    if (!host) {
      throw new Error('host_not_found');
    }

    const room: RoomDTO = {
      id: randomUUID(),
      hostUserId,
      gameType,
      status: 'open',
      createdAt: new Date().toISOString(),
      players: [
        {
          id: randomUUID(),
          roomId: '',
          userId: hostUserId,
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

  async joinRoom(roomId: string, userId: string): Promise<RoomDTO> {
    const room = this.rooms.get(roomId);
    const user = this.users.get(userId);
    if (!room || !user) {
      throw new Error('room_or_user_not_found');
    }

    const alreadyInRoom = room.players.some((player) => player.userId === userId);
    if (alreadyInRoom) {
      return room;
    }

    const max = room.gameType === 'gomoku' ? 2 : 1;
    if (room.players.length >= max) {
      throw new Error('capacity');
    }

    room.players.push({
      id: randomUUID(),
      roomId,
      userId,
      seat: room.players.length + 1,
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
  });

  it('requires authentication for /me', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    await request(app).get('/me').expect(401);
  });

  it('supports room create, join, and leave lifecycle', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const hostAuth = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const guestAuth = await request(app).post('/auth/guest').send({ displayName: 'Guest' }).expect(201);

    const createdRoom = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${hostAuth.body.token}`)
      .send({ gameType: 'gomoku' })
      .expect(201);

    const roomId = createdRoom.body.room.id;

    const joined = await request(app)
      .post(`/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${guestAuth.body.token}`)
      .expect(200);

    expect(joined.body.room.players).toHaveLength(2);

    const afterGuestLeaves = await request(app)
      .post(`/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${guestAuth.body.token}`)
      .expect(200);

    expect(afterGuestLeaves.body.room.players).toHaveLength(1);

    const hostLeaves = await request(app)
      .post(`/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${hostAuth.body.token}`)
      .expect(200);

    expect(hostLeaves.body.room).toBeNull();
  });

  it('creates and accepts invitations', async () => {
    const store = new InMemoryStore();
    const app = createApp(store);

    const hostAuth = await request(app).post('/auth/guest').send({ displayName: 'Host' }).expect(201);
    const guestAuth = await request(app).post('/auth/guest').send({ displayName: 'Guest' }).expect(201);

    const room = await request(app)
      .post('/rooms')
      .set('Authorization', `Bearer ${hostAuth.body.token}`)
      .send({ gameType: 'gomoku' })
      .expect(201);

    const invitation = await request(app)
      .post('/invitations')
      .set('Authorization', `Bearer ${hostAuth.body.token}`)
      .send({ roomId: room.body.room.id, toUserId: guestAuth.body.user.id })
      .expect(201);

    const invites = await request(app)
      .get('/invitations')
      .set('Authorization', `Bearer ${guestAuth.body.token}`)
      .expect(200);

    expect(invites.body.invitations).toHaveLength(1);

    const response = await request(app)
      .post(`/invitations/${invitation.body.invitation.id}/respond`)
      .set('Authorization', `Bearer ${guestAuth.body.token}`)
      .send({ action: 'accept' })
      .expect(200);

    expect(response.body.invitation.status).toBe('accepted');
    expect(response.body.room.players).toHaveLength(2);
  });
});
