import type { ApiError } from '@multiwebgame/shared-types';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ZodError, z } from 'zod';

import { requireAuth, signAuthToken, type AuthedRequest } from './auth.js';
import { config } from './config.js';
import { StoreError, type Store } from './store/types.js';

const createGuestSchema = z.object({
  displayName: z.string().trim().min(2).max(24).optional()
});

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(24),
  email: z.string().trim().email(),
  password: z.string().min(8).max(72)
});

const upgradeGuestSchema = registerSchema;

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72)
});

const createRoomSchema = z.object({
  gameType: z.enum(['single_2048', 'gomoku', 'xiangqi', 'go']),
  maxPlayers: z.number().int().min(1).max(8).optional()
});

const joinRoomSchema = z.object({
  asSpectator: z.boolean().optional()
});

const createInvitationSchema = z.object({
  roomId: z.string().uuid(),
  toUserId: z.string().uuid()
});

const respondInvitationSchema = z.object({
  action: z.enum(['accept', 'decline'])
});

const blockUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(2).max(240).optional()
});

const reportUserSchema = z
  .object({
    targetUserId: z.string().uuid().optional(),
    matchId: z.string().uuid().optional(),
    reason: z.string().trim().min(4).max(240),
    details: z.string().trim().max(1000).optional()
  })
  .refine((value) => value.targetUserId || value.matchId, {
    message: 'targetUserId or matchId is required'
  });

const historyQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 20))
    .pipe(z.number().int().min(1).max(100))
});

function randomGuestName(): string {
  return `Guest-${Math.random().toString(36).slice(2, 8)}`;
}

function firstParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function mapStoreError(error: StoreError): { status: number; body: ApiError } {
  switch (error.code) {
    case 'not_found':
      return { status: 404, body: { error: error.message } };
    case 'conflict':
    case 'capacity_reached':
      return { status: 409, body: { error: error.message } };
    case 'validation_error':
      return { status: 400, body: { error: error.message } };
    case 'forbidden':
      return { status: 403, body: { error: error.message } };
    case 'unauthorized':
      return { status: 401, body: { error: error.message } };
    default:
      return { status: 500, body: { error: 'Internal server error' } };
  }
}

export function createApp(store: Store) {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.webOrigin,
      credentials: false
    })
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/auth/guest', async (req, res, next) => {
    try {
      const input = createGuestSchema.parse(req.body ?? {});
      const user = await store.createGuestUser(input.displayName ?? randomGuestName());
      const session = await store.createSession(user.id);
      const token = signAuthToken({ sessionId: session.id, userId: user.id });
      res.status(201).json({ token, user, session });
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/register', async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await store.createRegisteredUser({
        displayName: input.displayName,
        email: input.email,
        passwordHash
      });
      const session = await store.createSession(user.id);
      const token = signAuthToken({ sessionId: session.id, userId: user.id });
      res.status(201).json({ token, user, session });
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/login', async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);
      const found = await store.findUserByEmail(input.email);
      if (!found) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(input.password, found.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const session = await store.createSession(found.user.id);
      const token = signAuthToken({ sessionId: session.id, userId: found.user.id });
      res.json({ token, user: found.user, session });
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/upgrade', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = upgradeGuestSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(input.password, 10);
      const user = await store.upgradeGuestUser({
        userId: req.auth!.userId,
        displayName: input.displayName,
        email: input.email,
        passwordHash
      });
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.post('/auth/logout', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      await store.deleteSession(req.auth!.sessionId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get('/me', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const user = await store.getUserById(req.auth!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const session = await store.getSessionById(req.auth!.sessionId);
      if (!session) {
        res.status(401).json({ error: 'Session not found' });
        return;
      }

      res.json({ user, session });
    } catch (error) {
      next(error);
    }
  });

  app.get('/ratings/me', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const ratings = await store.listRatingsForUser(req.auth!.userId);
      res.json({ ratings });
    } catch (error) {
      next(error);
    }
  });

  app.get('/rooms', requireAuth(store), async (_req, res, next) => {
    try {
      const rooms = await store.listOpenRooms();
      res.json({ rooms });
    } catch (error) {
      next(error);
    }
  });

  app.post('/rooms', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = createRoomSchema.parse(req.body);
      const room = await store.createRoom(req.auth!.userId, input.gameType, input.maxPlayers);
      res.status(201).json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.get('/rooms/:roomId', requireAuth(store), async (req, res, next) => {
    try {
      const room = await store.getRoomById(firstParam(req.params.roomId));
      if (!room) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post('/rooms/:roomId/join', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = joinRoomSchema.parse(req.body ?? {});
      const room = await store.joinRoom(firstParam(req.params.roomId), req.auth!.userId, input.asSpectator);
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.post('/rooms/:roomId/leave', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const room = await store.leaveRoom(firstParam(req.params.roomId), req.auth!.userId);
      res.json({ room });
    } catch (error) {
      next(error);
    }
  });

  app.get('/invitations', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const invitations = await store.listInvitationsForUser(req.auth!.userId);
      res.json({ invitations });
    } catch (error) {
      next(error);
    }
  });

  app.post('/invitations', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = createInvitationSchema.parse(req.body);
      const invitation = await store.createInvitation({
        roomId: input.roomId,
        fromUserId: req.auth!.userId,
        toUserId: input.toUserId
      });
      res.status(201).json({ invitation });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    '/invitations/:invitationId/respond',
    requireAuth(store),
    async (req: AuthedRequest, res, next) => {
      try {
        const input = respondInvitationSchema.parse(req.body);
        const invitation = await store.respondInvitation({
          invitationId: firstParam(req.params.invitationId),
          userId: req.auth!.userId,
          action: input.action
        });

        let room = null;
        if (invitation.status === 'accepted') {
          room = await store.joinRoom(invitation.roomId, req.auth!.userId, false);
        }

        res.json({ invitation, room });
      } catch (error) {
        next(error);
      }
    }
  );

  app.get('/matches/history', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const query = historyQuerySchema.parse(req.query);
      const matches = await store.listMatchHistoryForUser(req.auth!.userId, query.limit);
      res.json({ matches });
    } catch (error) {
      next(error);
    }
  });

  app.get('/matches/:matchId', requireAuth(store), async (req, res, next) => {
    try {
      const match = await store.getMatchById(firstParam(req.params.matchId));
      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      res.json({ match });
    } catch (error) {
      next(error);
    }
  });

  app.get('/moderation/blocks', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const blocks = await store.listBlockedUsers(req.auth!.userId);
      res.json({ blocks });
    } catch (error) {
      next(error);
    }
  });

  app.post('/moderation/blocks', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = blockUserSchema.parse(req.body);
      const block = await store.blockUser({
        blockerUserId: req.auth!.userId,
        blockedUserId: input.userId,
        reason: input.reason
      });
      res.status(201).json({ block });
    } catch (error) {
      next(error);
    }
  });

  app.post('/moderation/reports', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const input = reportUserSchema.parse(req.body);
      await store.reportUser({
        reporterUserId: req.auth!.userId,
        targetUserId: input.targetUserId,
        matchId: input.matchId,
        reason: input.reason,
        details: input.details
      });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (error: unknown, _req: express.Request, res: express.Response<ApiError>, _next: express.NextFunction) => {
      if (error instanceof StoreError) {
        const mapped = mapStoreError(error);
        res.status(mapped.status).json(mapped.body);
        return;
      }

      if (error instanceof ZodError) {
        res.status(400).json({
          error: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ')
        });
        return;
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  );

  return app;
}
