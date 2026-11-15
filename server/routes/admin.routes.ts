import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';

const router = Router();

// Vendor analytics endpoint (for Vendor Dashboard)
router.get('/vendor-analytics', requireAuth, requireRole('vendor'), (req, res, next) => {
  try {
    const db = getDb();
    const stall = db
      .prepare('SELECT id, name FROM food_stalls WHERE vendor_id = ?')
      .get(req.user!.userId) as { id: string; name: string } | undefined;

    if (!stall) {
      throw new AppError('No stall assigned to your account.', 404);
    }

    const summary = db
      .prepare(
        `SELECT
           COUNT(*) as totalOrders,
           COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Rejected') THEN total_amount ELSE 0 END), 0) as totalRevenue,
           COUNT(CASE WHEN status IN ('Placed', 'Accepted', 'Preparing', 'Ready') THEN 1 END) as activeOrders,
           COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completedOrders,
           COUNT(CASE WHEN date(created_at) = date('now') AND status NOT IN ('Cancelled', 'Rejected') THEN 1 END) as todayOrders,
           COALESCE(SUM(CASE WHEN date(created_at) = date('now') AND status NOT IN ('Cancelled', 'Rejected') THEN total_amount ELSE 0 END), 0) as todayRevenue
         FROM orders
         WHERE stall_id = ?`
      )
      .get(stall.id);

    const dailySales = db
      .prepare(
        `SELECT strftime('%m-%d', created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue
         FROM orders
         WHERE stall_id = ? AND status NOT IN ('Cancelled', 'Rejected')
         GROUP BY date(created_at)
         ORDER BY date(created_at) ASC
         LIMIT 14`
      )
      .all(stall.id);

    const topItems = db
      .prepare(
        `SELECT oi.item_name as name, SUM(oi.quantity) as unitsSold, SUM(oi.line_total) as revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.stall_id = ? AND o.status NOT IN ('Cancelled', 'Rejected')
         GROUP BY oi.menu_item_id, oi.item_name
         ORDER BY unitsSold DESC
         LIMIT 6`
      )
      .all(stall.id);

    res.json({ summary, dailySales, topItems });
  } catch (err) {
    next(err);
  }
});

// Admin platform overview analytics
router.get('/analytics', requireAuth, requireRole('admin'), (_req, res, next) => {
  try {
    const db = getDb();

    const kpis = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM orders) as totalOrders,
           (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE status NOT IN ('Cancelled', 'Rejected')) as totalRevenue,
           (SELECT COUNT(*) FROM orders WHERE status IN ('Placed', 'Accepted', 'Preparing', 'Ready')) as activeOrders,
           (SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = 1) as activeStudents,
           (SELECT COUNT(*) FROM users WHERE role = 'vendor' AND is_active = 1) as activeVendors,
           (SELECT COUNT(*) FROM food_stalls WHERE is_active = 1) as activeStalls,
           (SELECT COUNT(*) FROM menu_items WHERE stock_qty <= low_stock_threshold) as lowStockCount,
           (SELECT COUNT(*) FROM menu_items WHERE stock_qty = 0) as outOfStockCount`
      )
      .get();

    const revenueByStall = db
      .prepare(
        `SELECT s.id, s.name,
                COUNT(CASE WHEN o.status NOT IN ('Cancelled', 'Rejected') THEN 1 END) as orders,
                COALESCE(SUM(CASE WHEN o.status NOT IN ('Cancelled', 'Rejected') THEN o.total_amount ELSE 0 END), 0) as revenue
         FROM food_stalls s
         LEFT JOIN orders o ON o.stall_id = s.id
         GROUP BY s.id, s.name
         ORDER BY revenue DESC`
      )
      .all();

    const dailyRevenue = db
      .prepare(
        `SELECT strftime('%m-%d', created_at) as date,
                COUNT(*) as orders,
                COALESCE(SUM(total_amount), 0) as revenue
         FROM orders
         WHERE status NOT IN ('Cancelled', 'Rejected')
         GROUP BY date(created_at)
         ORDER BY date(created_at) ASC
         LIMIT 14`
      )
      .all();

    const ordersByStatus = db
      .prepare(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`)
      .all();

    res.json({ kpis, revenueByStall, dailyRevenue, ordersByStatus });
  } catch (err) {
    next(err);
  }
});

// Admin: list all users
router.get('/users', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const role = typeof req.query.role === 'string' ? req.query.role : '';
    const whereClause = role && role !== 'all' ? 'WHERE u.role = ?' : '';
    const params = role && role !== 'all' ? [role] : [];

    const users = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.campus_id, u.phone, u.is_active, u.created_at,
                s.id as stall_id, s.name as stall_name
         FROM users u
         LEFT JOIN food_stalls s ON s.vendor_id = u.id
         ${whereClause}
         ORDER BY u.created_at DESC`
      )
      .all(...params);

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// Admin: create vendor account (optionally with stall)
const createVendorSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(100),
  campusId: z.string().trim().min(2).max(32),
  phone: z.string().trim().min(7).max(20),
});

router.post('/vendors', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const parsed = createVendorSchema.parse(req.body);
    const db = getDb();
    const email = parsed.email.toLowerCase();

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(email);
    if (existing) {
      throw new AppError('An account with this email already exists.', 409);
    }

    const now = new Date().toISOString();
    const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
    const hash = bcrypt.hashSync(parsed.password, 10);

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, role, campus_id, phone, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'vendor', ?, ?, 1, ?, ?)`
    ).run(id, parsed.name, email, hash, parsed.campusId, parsed.phone, now, now);

    const created = db
      .prepare('SELECT id, name, email, role, campus_id, phone, is_active, created_at FROM users WHERE id = ?')
      .get(id);

    res.status(201).json({ user: created });
  } catch (err) {
    next(err);
  }
});

// Admin: activate / suspend user account
router.patch('/users/:id/status', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    if (req.params.id === req.user!.userId && !isActive) {
      throw new AppError('You cannot suspend your own administrator account.', 400);
    }

    const db = getDb();
    const resUpdate = db
      .prepare('UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?')
      .run(isActive ? 1 : 0, new Date().toISOString(), req.params.id);

    if (resUpdate.changes === 0) {
      throw new AppError('User not found.', 404);
    }

    const updated = db
      .prepare('SELECT id, name, email, role, campus_id, phone, is_active FROM users WHERE id = ?')
      .get(req.params.id);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});

// Public / Admin: read platform settings
router.get('/settings', (_req, res, next) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM platform_settings WHERE id = 1').get();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Admin: update platform settings
router.patch('/settings', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const parsed = z
      .object({
        campusName: z.string().trim().min(3).max(120).optional(),
        taxRatePercent: z.number().min(0).max(30).optional(),
        platformFeeFlat: z.number().min(0).max(100).optional(),
        allowOrdering: z.boolean().optional(),
        cancellableStatuses: z.string().trim().min(1).optional(),
        defaultLowStockThreshold: z.number().int().min(1).max(100).optional(),
      })
      .parse(req.body);

    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE platform_settings SET
        campus_name = COALESCE(?, campus_name),
        tax_rate_percent = COALESCE(?, tax_rate_percent),
        platform_fee_flat = COALESCE(?, platform_fee_flat),
        allow_ordering = COALESCE(?, allow_ordering),
        cancellable_statuses = COALESCE(?, cancellable_statuses),
        default_low_stock_threshold = COALESCE(?, default_low_stock_threshold),
        updated_at = ?
       WHERE id = 1`
    ).run(
      parsed.campusName ?? null,
      parsed.taxRatePercent ?? null,
      parsed.platformFeeFlat ?? null,
      parsed.allowOrdering !== undefined ? (parsed.allowOrdering ? 1 : 0) : null,
      parsed.cancellableStatuses ?? null,
      parsed.defaultLowStockThreshold ?? null,
      now
    );

    const updated = db.prepare('SELECT * FROM platform_settings WHERE id = 1').get();
    res.json({ settings: updated });
  } catch (err) {
    next(err);
  }
});

// Admin: CSV Report Download (orders, revenue, low-stock)
router.get('/reports/export', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const type = String(req.query.type || 'orders');
    const db = getDb();
    let csv = '';

    if (type === 'inventory') {
      const rows = db
        .prepare(
          `SELECT m.id, s.name as stall, m.name as item, m.category, m.price, m.stock_qty, m.low_stock_threshold, m.is_available
           FROM menu_items m JOIN food_stalls s ON s.id = m.stall_id
           ORDER BY s.name, m.stock_qty ASC`
        )
        .all() as Record<string, unknown>[];

      csv = 'Item ID,Stall,Item Name,Category,Price,Stock Qty,Low Stock Threshold,Available\n';
      csv += rows
        .map((r) =>
          [
            r.id,
            `"${String(r.stall).replace(/"/g, '""')}"`,
            `"${String(r.item).replace(/"/g, '""')}"`,
            `"${String(r.category).replace(/"/g, '""')}"`,
            r.price,
            r.stock_qty,
            r.low_stock_threshold,
            r.is_available ? 'Yes' : 'No',
          ].join(',')
        )
        .join('\n');
    } else {
      const rows = db
        .prepare(
          `SELECT o.order_code, o.created_at, s.name as stall, u.name as student, u.campus_id,
                  o.subtotal, o.tax_amount, o.platform_fee, o.total_amount, o.status, p.status as payment_status
           FROM orders o
           JOIN food_stalls s ON s.id = o.stall_id
           JOIN users u ON u.id = o.student_id
           LEFT JOIN payments p ON p.order_id = o.id
           ORDER BY o.created_at DESC`
        )
        .all() as Record<string, unknown>[];

      csv = 'Order Code,Timestamp,Stall,Student,Campus ID,Subtotal,Tax,Platform Fee,Total,Order Status,Payment Status\n';
      csv += rows
        .map((r) =>
          [
            r.order_code,
            r.created_at,
            `"${String(r.stall).replace(/"/g, '""')}"`,
            `"${String(r.student).replace(/"/g, '""')}"`,
            r.campus_id,
            r.subtotal,
            r.tax_amount,
            r.platform_fee,
            r.total_amount,
            r.status,
            `"${String(r.payment_status || 'N/A')}"`,
          ].join(',')
        )
        .join('\n');
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="campusbite-${type}-report.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
