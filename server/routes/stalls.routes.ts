import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

const stallUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(5).max(400).optional(),
  cuisineType: z.string().trim().min(2).max(60).optional(),
  location: z.string().trim().min(2).max(120).optional(),
  openingHours: z.string().trim().min(3).max(80).optional(),
  avgPrepMinutes: z.number().int().min(2).max(90).optional(),
  isOpen: z.boolean().optional(),
  imageUrl: z.string().trim().min(1).optional(),
});

// Public / Student: browse active food stalls
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const includeInactive = req.query.includeInactive === 'true';

    const rows = db
      .prepare(
        `SELECT s.*, u.name as vendor_name, u.email as vendor_email,
                (SELECT COUNT(*) FROM menu_items m WHERE m.stall_id = s.id AND m.is_available = 1 AND m.stock_qty > 0) as available_items_count,
                (SELECT COUNT(*) FROM menu_items m WHERE m.stall_id = s.id) as total_items_count
         FROM food_stalls s
         JOIN users u ON u.id = s.vendor_id
         ${includeInactive ? '' : 'WHERE s.is_active = 1'}
         ORDER BY s.rating DESC, s.name ASC`
      )
      .all();

    res.json({ stalls: rows });
  } catch (err) {
    next(err);
  }
});

// Vendor: get own stall details
router.get('/my-stall', requireAuth, requireRole('vendor'), (req, res, next) => {
  try {
    const db = getDb();
    const stall = db
      .prepare('SELECT * FROM food_stalls WHERE vendor_id = ?')
      .get(req.user!.userId);

    if (!stall) {
      throw new AppError('No food stall is assigned to this vendor account.', 404);
    }

    res.json({ stall });
  } catch (err) {
    next(err);
  }
});

// Get single stall with its menu items
router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const stall = db
      .prepare(
        `SELECT s.*, u.name as vendor_name
         FROM food_stalls s
         JOIN users u ON u.id = s.vendor_id
         WHERE s.id = ? OR s.slug = ?`
      )
      .get(req.params.id, req.params.id) as { id: string } | undefined;

    if (!stall) {
      throw new AppError('Food stall not found.', 404);
    }

    const items = db
      .prepare('SELECT * FROM menu_items WHERE stall_id = ? ORDER BY is_bestseller DESC, name ASC')
      .all(stall.id);

    res.json({ stall, items });
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: update stall details
router.patch('/:id', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = stallUpdateSchema.parse(req.body);
    const db = getDb();

    const stall = db
      .prepare('SELECT * FROM food_stalls WHERE id = ?')
      .get(req.params.id) as { id: string; vendor_id: string } | undefined;

    if (!stall) {
      throw new AppError('Food stall not found.', 404);
    }

    if (req.user!.role === 'vendor' && stall.vendor_id !== req.user!.userId) {
      throw new AppError('You can only update your own food stall.', 403);
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE food_stalls SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        cuisine_type = COALESCE(?, cuisine_type),
        location = COALESCE(?, location),
        opening_hours = COALESCE(?, opening_hours),
        avg_prep_minutes = COALESCE(?, avg_prep_minutes),
        is_open = COALESCE(?, is_open),
        image_url = COALESCE(?, image_url),
        updated_at = ?
       WHERE id = ?`
    ).run(
      parsed.name ?? null,
      parsed.description ?? null,
      parsed.cuisineType ?? null,
      parsed.location ?? null,
      parsed.openingHours ?? null,
      parsed.avgPrepMinutes ?? null,
      parsed.isOpen !== undefined ? (parsed.isOpen ? 1 : 0) : null,
      parsed.imageUrl ?? null,
      now,
      stall.id
    );

    const updated = db.prepare('SELECT * FROM food_stalls WHERE id = ?').get(stall.id);
    res.json({ stall: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: create new food stall
const createStallSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(400),
  cuisineType: z.string().trim().min(2).max(60),
  location: z.string().trim().min(2).max(120),
  openingHours: z.string().trim().min(3).max(80).default('09:00 AM - 09:00 PM'),
  avgPrepMinutes: z.number().int().min(2).max(90).default(12),
  imageUrl: z.string().trim().min(1).default('/src/assets/images/food_smash_burger_1794579764199.jpg'),
});

router.post('/', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const parsed = createStallSchema.parse(req.body);
    const db = getDb();

    const vendor = db
      .prepare("SELECT id, role FROM users WHERE id = ? AND role = 'vendor'")
      .get(parsed.vendorId);
    if (!vendor) {
      throw new AppError('Specified vendor user account not found.', 404);
    }

    const now = new Date().toISOString();
    const id = `stl_${crypto.randomUUID().slice(0, 8)}`;
    const slug = `${parsed.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;

    db.prepare(
      `INSERT INTO food_stalls (id, vendor_id, name, slug, description, cuisine_type, location, opening_hours, avg_prep_minutes, rating, image_url, is_open, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 4.7, ?, 1, 1, ?, ?)`
    ).run(
      id,
      parsed.vendorId,
      parsed.name,
      slug,
      parsed.description,
      parsed.cuisineType,
      parsed.location,
      parsed.openingHours,
      parsed.avgPrepMinutes,
      parsed.imageUrl,
      now,
      now
    );

    const created = db.prepare('SELECT * FROM food_stalls WHERE id = ?').get(id);
    res.status(201).json({ stall: created });
  } catch (err) {
    next(err);
  }
});

// Admin: toggle stall active status
router.patch('/:id/active', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const db = getDb();
    const now = new Date().toISOString();

    const result = db
      .prepare('UPDATE food_stalls SET is_active = ?, updated_at = ? WHERE id = ?')
      .run(isActive ? 1 : 0, now, req.params.id);

    if (result.changes === 0) {
      throw new AppError('Food stall not found.', 404);
    }

    const updated = db.prepare('SELECT * FROM food_stalls WHERE id = ?').get(req.params.id);
    res.json({ stall: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
