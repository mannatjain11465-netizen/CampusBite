import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.ts';
import { getDb } from '../db/database.ts';

export type UserRole = 'student' | 'vendor' | 'admin';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signAuthToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    const db = getDb();
    const userRow = db
      .prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?')
      .get(decoded.userId) as { id: string; name: string; email: string; role: UserRole; is_active: number } | undefined;

    if (!userRow) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }
    if (!userRow.is_active) {
      res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
      return;
    }

    req.user = {
      userId: userRow.id,
      email: userRow.email,
      role: userRow.role,
      name: userRow.name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
