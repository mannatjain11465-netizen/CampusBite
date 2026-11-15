import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, signAuthToken } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Please provide a valid campus email'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  campusId: z.string().trim().min(3, 'Campus Roll ID is required').max(32),
  phone: z.string().trim().min(7, 'Phone number is required').max(20),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const db = getDb();
    const normalizedEmail = parsed.email.toLowerCase();

    const existing = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = ?')
      .get(normalizedEmail);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409);
    }

    const now = new Date().toISOString();
    const userId = `usr_${crypto.randomUUID()}`;
    const passwordHash = bcrypt.hashSync(parsed.password, 10);

    // Public registration always creates a student account (prevents privilege escalation)
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, campus_id, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'student', ?, ?, 1, ?, ?)`
    ).run(userId, parsed.name, normalizedEmail, passwordHash, parsed.campusId, parsed.phone, now, now);

    const token = signAuthToken({
      userId,
      email: normalizedEmail,
      role: 'student',
      name: parsed.name,
    });

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: parsed.name,
        email: normalizedEmail,
        role: 'student',
        campusId: parsed.campusId,
        phone: parsed.phone,
        isActive: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const db = getDb();
    const normalizedEmail = parsed.email.toLowerCase();

    const user = db
      .prepare('SELECT * FROM users WHERE LOWER(email) = ?')
      .get(normalizedEmail) as
      | {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: 'student' | 'vendor' | 'admin';
          campus_id: string;
          phone: string;
          is_active: number;
        }
      | undefined;

    if (!user || !bcrypt.compareSync(parsed.password, user.password_hash)) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (!user.is_active) {
      throw new AppError('Your account has been suspended by campus administration.', 403);
    }

    const stall =
      user.role === 'vendor'
        ? (db
            .prepare('SELECT id, name, is_open, is_active FROM food_stalls WHERE vendor_id = ?')
            .get(user.id) as { id: string; name: string; is_open: number; is_active: number } | undefined)
        : undefined;

    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        campusId: user.campus_id,
        phone: user.phone,
        isActive: Boolean(user.is_active),
        stall: stall
          ? {
              id: stall.id,
              name: stall.name,
              isOpen: Boolean(stall.is_open),
              isActive: Boolean(stall.is_active),
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const user = db
      .prepare('SELECT id, name, email, role, campus_id, phone, is_active, created_at FROM users WHERE id = ?')
      .get(req.user!.userId) as
      | {
          id: string;
          name: string;
          email: string;
          role: 'student' | 'vendor' | 'admin';
          campus_id: string;
          phone: string;
          is_active: number;
          created_at: string;
        }
      | undefined;

    if (!user) {
      throw new AppError('User account not found.', 404);
    }

    const stall =
      user.role === 'vendor'
        ? (db
            .prepare('SELECT * FROM food_stalls WHERE vendor_id = ?')
            .get(user.id) as Record<string, unknown> | undefined)
        : undefined;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        campusId: user.campus_id,
        phone: user.phone,
        isActive: Boolean(user.is_active),
        createdAt: user.created_at,
        stall: stall || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
