import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { uploadMenuImage } from '../middleware/upload.ts';

const router = Router();

const menuItemCreateSchema = z.object({
  stallId: z.string().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(400),
  category: z.string().trim().min(2).max(50),
  price: z.number().positive().max(10000),
  imageUrl: z.string().trim().min(1).default('/src/assets/images/food_smash_burger_1794579764199.jpg'),
  isVeg: z.boolean().default(true),
  isBestseller: z.boolean().default(false),
  prepMinutes: z.number().int().min(1).max(120).default(10),
  stockQty: z.number().int().min(0).max(10000).default(20),
  lowStockThreshold: z.number().int().min(1).max(500).default(10),
  isAvailable: z.boolean().default(true),
});

const menuItemUpdateSchema = menuItemCreateSchema.partial();

// Browse / search / filter menu items
router.get('/', (req, res, next) => {
  try {
    const db = getDb();
    const {
      search,
      category,
      stallId,
      vegOnly,
      inStockOnly,
      bestsellersOnly,
      includeInactiveStalls,
    } = req.query;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (includeInactiveStalls !== 'true') {
      conditions.push('s.is_active = 1');
    }

    if (typeof search === 'string' && search.trim()) {
      conditions.push('(LOWER(m.name) LIKE ? OR LOWER(m.description) LIKE ? OR LOWER(s.name) LIKE ?)');
      const term = `%${search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    if (typeof category === 'string' && category.trim() && category !== 'All') {
      conditions.push('m.category = ?');
      params.push(category.trim());
    }

    if (typeof stallId === 'string' && stallId.trim()) {
      conditions.push('m.stall_id = ?');
      params.push(stallId.trim());
    }

    if (vegOnly === 'true') {
      conditions.push('m.is_veg = 1');
    }

    if (inStockOnly === 'true') {
      conditions.push('m.stock_qty > 0 AND m.is_available = 1 AND s.is_open = 1');
    }

    if (bestsellersOnly === 'true') {
      conditions.push('m.is_bestseller = 1');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = db
      .prepare(
        `SELECT m.*, s.name as stall_name, s.location as stall_location, s.is_open as stall_is_open, s.avg_prep_minutes as stall_prep_minutes
         FROM menu_items m
         JOIN food_stalls s ON s.id = m.stall_id
         ${whereClause}
         ORDER BY m.is_bestseller DESC, m.stock_qty DESC, m.name ASC`
      )
      .all(...params);

    const categoriesRows = db
      .prepare('SELECT DISTINCT category FROM menu_items ORDER BY category ASC')
      .all() as { category: string }[];

    res.json({
      items,
      categories: categoriesRows.map((c) => c.category),
    });
  } catch (err) {
    next(err);
  }
});

// Upload menu item image (Vendor or Admin)
router.post(
  '/upload',
  requireAuth,
  requireRole('vendor', 'admin'),
  uploadMenuImage.single('image'),
  (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('Please attach an image file under the "image" field.', 400);
      }
      res.status(201).json({
        imageUrl: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Vendor or Admin: create new menu item
router.post('/', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = menuItemCreateSchema.parse(req.body);
    const db = getDb();

    let targetStallId = parsed.stallId;
    if (req.user!.role === 'vendor') {
      const ownStall = db
        .prepare('SELECT id FROM food_stalls WHERE vendor_id = ?')
        .get(req.user!.userId) as { id: string } | undefined;
      if (!ownStall) {
        throw new AppError('No food stall assigned to your vendor account.', 404);
      }
      targetStallId = ownStall.id;
    } else if (!targetStallId) {
      throw new AppError('stallId is required when creating items as Admin.', 400);
    }

    const now = new Date().toISOString();
    const itemId = `itm_${crypto.randomUUID().slice(0, 8)}`;

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        `INSERT INTO menu_items (id, stall_id, name, description, category, price, image_url, is_veg, is_bestseller, prep_minutes, stock_qty, low_stock_threshold, is_available, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        itemId,
        targetStallId,
        parsed.name,
        parsed.description,
        parsed.category,
        parsed.price,
        parsed.imageUrl,
        parsed.isVeg ? 1 : 0,
        parsed.isBestseller ? 1 : 0,
        parsed.prepMinutes,
        parsed.stockQty,
        parsed.lowStockThreshold,
        parsed.isAvailable ? 1 : 0,
        now,
        now
      );

      if (parsed.stockQty > 0) {
        db.prepare(
          `INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
           VALUES (?, ?, ?, 'restock', 0, ?, ?, 'NEW-ITEM', 'Initial item stock', ?, ?)`
        ).run(
          `inv_${crypto.randomUUID()}`,
          itemId,
          targetStallId,
          parsed.stockQty,
          parsed.stockQty,
          req.user!.userId,
          now
        );
      }

      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }

    const created = db
      .prepare(
        `SELECT m.*, s.name as stall_name, s.location as stall_location, s.is_open as stall_is_open
         FROM menu_items m JOIN food_stalls s ON s.id = m.stall_id WHERE m.id = ?`
      )
      .get(itemId);

    res.status(201).json({ item: created });
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: update menu item
router.patch('/:id', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = menuItemUpdateSchema.parse(req.body);
    const db = getDb();

    const item = db
      .prepare(
        `SELECT m.*, s.vendor_id FROM menu_items m JOIN food_stalls s ON s.id = m.stall_id WHERE m.id = ?`
      )
      .get(req.params.id) as { id: string; vendor_id: string } | undefined;

    if (!item) {
      throw new AppError('Menu item not found.', 404);
    }

    if (req.user!.role === 'vendor' && item.vendor_id !== req.user!.userId) {
      throw new AppError('You can only edit menu items from your own stall.', 403);
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE menu_items SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        image_url = COALESCE(?, image_url),
        is_veg = COALESCE(?, is_veg),
        is_bestseller = COALESCE(?, is_bestseller),
        prep_minutes = COALESCE(?, prep_minutes),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        is_available = COALESCE(?, is_available),
        updated_at = ?
       WHERE id = ?`
    ).run(
      parsed.name ?? null,
      parsed.description ?? null,
      parsed.category ?? null,
      parsed.price ?? null,
      parsed.imageUrl ?? null,
      parsed.isVeg !== undefined ? (parsed.isVeg ? 1 : 0) : null,
      parsed.isBestseller !== undefined ? (parsed.isBestseller ? 1 : 0) : null,
      parsed.prepMinutes ?? null,
      parsed.lowStockThreshold ?? null,
      parsed.isAvailable !== undefined ? (parsed.isAvailable ? 1 : 0) : null,
      now,
      item.id
    );

    const updated = db
      .prepare(
        `SELECT m.*, s.name as stall_name, s.location as stall_location, s.is_open as stall_is_open
         FROM menu_items m JOIN food_stalls s ON s.id = m.stall_id WHERE m.id = ?`
      )
      .get(item.id);

    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: delete menu item (only if no order_items reference it; otherwise soft-disable)
router.delete('/:id', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const db = getDb();
    const item = db
      .prepare(
        `SELECT m.*, s.vendor_id FROM menu_items m JOIN food_stalls s ON s.id = m.stall_id WHERE m.id = ?`
      )
      .get(req.params.id) as { id: string; vendor_id: string } | undefined;

    if (!item) {
      throw new AppError('Menu item not found.', 404);
    }

    if (req.user!.role === 'vendor' && item.vendor_id !== req.user!.userId) {
      throw new AppError('You can only delete items from your own stall.', 403);
    }

    const orderCount = db
      .prepare('SELECT COUNT(*) as count FROM order_items WHERE menu_item_id = ?')
      .get(item.id) as { count: number };

    if (orderCount.count > 0) {
      // Preserve referential integrity for historical orders
      db.prepare('UPDATE menu_items SET is_available = 0, stock_qty = 0, updated_at = ? WHERE id = ?').run(
        new Date().toISOString(),
        item.id
      );
      res.json({
        deleted: false,
        archived: true,
        message: 'Item has historical orders, so it was marked unavailable and zeroed out to preserve order records.',
      });
      return;
    }

    db.prepare('DELETE FROM menu_items WHERE id = ?').run(item.id);
    res.json({ deleted: true, archived: false, message: 'Menu item removed permanently.' });
  } catch (err) {
    next(err);
  }
});

export default router;
