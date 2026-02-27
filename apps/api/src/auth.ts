import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { SessionDTO } from '@multiwebgame/shared-types';

import { config } from './config.js';
import type { Store } from './store/types.js';

interface AuthTokenPayload {
  sessionId: string;
  userId: string;
  iat?: number;
  exp?: number;
}

export interface AuthContext {
  sessionId: string;
  userId: string;
  session?: SessionDTO;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}

export function signAuthToken(payload: AuthContext): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '30d' });
}

function parseBearerToken(value?: string): string | null {
  if (!value) {
    return null;
  }

  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

function isJwtVerificationError(error: unknown): boolean {
  if (error instanceof jwt.JsonWebTokenError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'TokenExpiredError' ||
    error.name === 'JsonWebTokenError' ||
    error.name === 'NotBeforeError'
  );
}

export function requireAuth(store: Store) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = parseBearerToken(req.headers.authorization);
      if (!token) {
        res.status(401).json({ error: 'Missing Bearer token' });
        return;
      }

      const payload = jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
      if (!payload.sessionId || !payload.userId) {
        res.status(401).json({ error: 'Invalid token payload' });
        return;
      }

      const session = await store.getSessionById(payload.sessionId);
      if (!session || session.userId !== payload.userId) {
        res.status(401).json({ error: 'Session expired or invalid' });
        return;
      }

      req.auth = {
        sessionId: session.id,
        userId: session.userId,
        session
      };
      next();
    } catch (error) {
      if (isJwtVerificationError(error)) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      next(error);
    }
  };
}
