import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { adjustMenuItemStock, restockMenuItem } from '../services/inventory.service.ts';

const router = Router();

// Vendor: view own stall inventory, low-stock items, and recent transactions
router.get('/vendor', requireAuth, requireRole('vendor'), (req, res, next) => {
  try {
    const db = getDb();
    const stall = db
      .prepare('SELECT id, name FROM food_stalls WHERE vendor_id = ?')
      .get(req.user!.userId) as { id: string; name: string } | undefined;

    if (!stall) {
      throw new AppError('No stall assigned to this vendor account.', 404);
    }

    const items = db
      .prepare(
        `SELECT * FROM menu_items WHERE stall_id = ? ORDER BY (stock_qty <= low_stock_threshold) DESC, stock_qty ASC, name ASC`
      )
      .all(stall.id);

    const lowStockItems = db
      .prepare(
        `SELECT * FROM menu_items WHERE stall_id = ? AND stock_qty <= low_stock_threshold ORDER BY stock_qty ASC`
      )
      .all(stall.id);

    const transactions = db
      .prepare(
        `SELECT t.*, m.name as item_name, u.name as actor_name
         FROM inventory_transactions t
         JOIN menu_items m ON m.id = t.menu_item_id
         LEFT JOIN users u ON u.id = t.created_by
         WHERE t.stall_id = ?
         ORDER BY t.created_at DESC
         LIMIT 50`
      )
      .all(stall.id);

    res.json({ stall, items, lowStockItems, transactions });
  } catch (err) {
    next(err);
  }
});

// Admin: view global inventory across all stalls & low-stock alerts
router.get('/admin', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const stallId = typeof req.query.stallId === 'string' ? req.query.stallId : '';
    const whereClause = stallId && stallId !== 'All' ? 'WHERE m.stall_id = ?' : '';
    const params = stallId && stallId !== 'All' ? [stallId] : [];

    const items = db
      .prepare(
        `SELECT m.*, s.name as stall_name, s.location as stall_location
         FROM menu_items m
         JOIN food_stalls s ON s.id = m.stall_id
         ${whereClause}
         ORDER BY (m.stock_qty <= m.low_stock_threshold) DESC, m.stock_qty ASC`
      )
      .all(...params);

    const lowStockItems = db
      .prepare(
        `SELECT m.*, s.name as stall_name
         FROM menu_items m
         JOIN food_stalls s ON s.id = m.stall_id
         WHERE m.stock_qty <= m.low_stock_threshold
         ORDER BY m.stock_qty ASC`
      )
      .all();

    const transactions = db
      .prepare(
        `SELECT t.*, m.name as item_name, s.name as stall_name, u.name as actor_name
         FROM inventory_transactions t
         JOIN menu_items m ON m.id = t.menu_item_id
         JOIN food_stalls s ON s.id = t.stall_id
         LEFT JOIN users u ON u.id = t.created_by
         ORDER BY t.created_at DESC
         LIMIT 80`
      )
      .all();

    res.json({ items, lowStockItems, transactions });
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: restock a menu item
router.post('/restock', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = z
      .object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive().max(5000),
        note: z.string().max(200).optional(),
        makeAvailable: z.boolean().optional(),
      })
      .parse(req.body);

    const db = getDb();
    const result = restockMenuItem(db, {
      menuItemId: parsed.menuItemId,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      addQuantity: parsed.quantity,
      note: parsed.note,
      makeAvailable: parsed.makeAvailable,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: manual stock reconciliation
router.post('/adjust', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = z
      .object({
        menuItemId: z.string().min(1),
        newStockQty: z.number().int().min(0).max(5000),
        note: z.string().max(200).optional(),
      })
      .parse(req.body);

    const db = getDb();
    const result = adjustMenuItemStock(db, {
      menuItemId: parsed.menuItemId,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      newStockQty: parsed.newStockQty,
      note: parsed.note,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
