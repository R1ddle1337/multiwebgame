import type { ApiError } from '@multiwebgame/shared-types';
import bcrypt from 'bcryptjs';
import cors, { type CorsOptions } from 'cors';
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
  gameType: z.enum([
    'single_2048',
    'gomoku',
    'xiangqi',
    'go',
    'connect4',
    'reversi',
    'dots',
    'backgammon',
    'cards',
    'quoridor',
    'hex'
  ]),
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

const reportListQuerySchema = z.object({
  status: z.enum(['open', 'reviewed', 'resolved', 'dismissed']).optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : 50))
    .pipe(z.number().int().min(1).max(200))
});

const resolveReportSchema = z.object({
  status: z.enum(['reviewed', 'resolved', 'dismissed'])
});

interface ParsedCorsOrigins {
  allowAny: boolean;
  allowed: Set<string>;
}

export interface CreateAppOptions {
  webOrigin?: string;
}

function randomGuestName(): string {
  return `Guest-${Math.random().toString(36).slice(2, 8)}`;
}

function firstParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function firstHeader(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function inviteLinkUrl(webOrigin: string, token: string): string {
  const base = normalizeOrigin(webOrigin).replace(/\/+$/, '');
  return `${base}/invite/${encodeURIComponent(token)}`;
}

function parseCorsOrigins(value: string): ParsedCorsOrigins {
  const candidates = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const allowAny = candidates.includes('*');
  const allowed = new Set(
    candidates
      .filter((entry) => entry !== '*')
      .map((entry) => normalizeOrigin(entry))
      .filter(Boolean)
  );

  return { allowAny, allowed };
}

function isOriginAllowed(origin: string, parsed: ParsedCorsOrigins): boolean {
  if (parsed.allowAny) {
    return true;
  }

  return parsed.allowed.has(normalizeOrigin(origin));
}

function isInvalidJsonBodyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const typed = error as { body?: unknown; name?: string; status?: number; type?: string };
  if (typed.type === 'entity.parse.failed') {
    return true;
  }

  return typed.status === 400 && typed.name === 'SyntaxError' && 'body' in typed;
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

export function createApp(store: Store, options: CreateAppOptions = {}) {
  const app = express();
  const parsedCors = parseCorsOrigins(options.webOrigin ?? config.webOrigin);
  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, isOriginAllowed(origin, parsedCors));
    },
    credentials: false
  };

  app.use(helmet());
  app.use((req, res, next) => {
    const origin = firstHeader(req.headers.origin);
    if (!origin || isOriginAllowed(origin, parsedCors)) {
      next();
      return;
    }

    res.status(403).json({ error: 'CORS origin denied' });
  });
  app.use(cors(corsOptions));
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

      const session = req.auth!.session ?? (await store.getSessionById(req.auth!.sessionId));
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

  app.get('/ratings/formula', async (_req, res, next) => {
    try {
      const formulas = await store.listRatingFormulas();
      res.json({ formulas });
    } catch (error) {
      next(error);
    }
  });

  app.get('/rooms', requireAuth(store), async (_req, res, next) => {
    try {
      const rooms = (await store.listOpenRooms()).filter(
        (room) => room.status !== 'closed' && room.players.length > 0
      );
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
      if (!room || room.status === 'closed' || room.players.length === 0) {
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

  app.post('/rooms/:roomId/invite-link', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const inviteLink = await store.createOrGetInviteLink({
        roomId: firstParam(req.params.roomId),
        createdByUserId: req.auth!.userId
      });

      res.json({
        roomId: inviteLink.roomId,
        token: inviteLink.token,
        url: inviteLinkUrl(options.webOrigin ?? config.webOrigin, inviteLink.token)
      });
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

  app.post('/invite-links/:token/accept', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const accepted = await store.acceptInviteLink({
        token: firstParam(req.params.token),
        userId: req.auth!.userId
      });
      res.json(accepted);
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

  app.get('/moderation/reports', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const user = await store.getUserById(req.auth!.userId);
      if (!user?.isAdmin) {
        res.status(403).json({ error: 'Admin role required' });
        return;
      }

      const query = reportListQuerySchema.parse(req.query);
      const reports = await store.listReports({
        status: query.status,
        limit: query.limit
      });

      res.json({ reports });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/moderation/reports/:reportId', requireAuth(store), async (req: AuthedRequest, res, next) => {
    try {
      const user = await store.getUserById(req.auth!.userId);
      if (!user?.isAdmin) {
        res.status(403).json({ error: 'Admin role required' });
        return;
      }

      const input = resolveReportSchema.parse(req.body);
      const report = await store.resolveReport({
        reportId: firstParam(req.params.reportId),
        status: input.status
      });
      res.json({ report });
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res: express.Response<ApiError>) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(
    (error: unknown, _req: express.Request, res: express.Response<ApiError>, _next: express.NextFunction) => {
      if (isInvalidJsonBodyError(error)) {
        res.status(400).json({ error: 'Invalid JSON body' });
        return;
      }

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
