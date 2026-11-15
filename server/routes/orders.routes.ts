import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db/database.ts';
import { requireAuth, requireRole } from '../middleware/auth.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  cancelOrderByStudent,
  getOrderDetailsById,
  OrderStatus,
  placeOrdersAtomically,
  updateOrderStatusByVendor,
} from '../services/order.service.ts';

const router = Router();

const placeOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menuItemId: z.string().min(1),
        quantity: z.number().int().positive().max(50),
      })
    )
    .min(1, 'Cart cannot be empty'),
  pickupTime: z.string().trim().min(2).max(60),
  paymentMethod: z
    .enum(['UPI (Simulated)', 'Campus Wallet (Simulated)', 'Card (Simulated)'])
    .default('UPI (Simulated)'),
  specialInstructions: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

// Student: place order(s) with atomic stock deduction & simulated payment
router.post('/', requireAuth, requireRole('student'), (req, res, next) => {
  try {
    const parsed = placeOrderSchema.parse(req.body);
    const db = getDb();

    const result = placeOrdersAtomically(db, {
      studentId: req.user!.userId,
      studentName: req.user!.name,
      items: parsed.items,
      pickupTime: parsed.pickupTime,
      paymentMethod: parsed.paymentMethod,
      specialInstructions: parsed.specialInstructions,
      idempotencyKey: parsed.idempotencyKey,
    });

    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

// Student: view own orders
router.get('/my-orders', requireAuth, requireRole('student'), (req, res, next) => {
  try {
    const db = getDb();
    const orders = db
      .prepare(
        `SELECT o.*, s.name as stall_name, s.location as stall_location,
                p.method as payment_method, p.status as payment_status, p.transaction_ref as payment_ref, p.is_simulated
         FROM orders o
         JOIN food_stalls s ON s.id = o.stall_id
         LEFT JOIN payments p ON p.order_id = o.id
         WHERE o.student_id = ?
         ORDER BY o.created_at DESC`
      )
      .all(req.user!.userId) as { id: string }[];

    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enriched = orders.map((o) => ({
      ...o,
      items: itemsStmt.all(o.id),
    }));

    res.json({ orders: enriched });
  } catch (err) {
    next(err);
  }
});

// Vendor: view orders for own stall
router.get('/vendor-orders', requireAuth, requireRole('vendor'), (req, res, next) => {
  try {
    const db = getDb();
    const stall = db
      .prepare('SELECT id FROM food_stalls WHERE vendor_id = ?')
      .get(req.user!.userId) as { id: string } | undefined;

    if (!stall) {
      throw new AppError('No stall assigned to your vendor account.', 404);
    }

    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const whereStatus = statusFilter && statusFilter !== 'All' ? 'AND o.status = ?' : '';
    const params = statusFilter && statusFilter !== 'All' ? [stall.id, statusFilter] : [stall.id];

    const orders = db
      .prepare(
        `SELECT o.*, s.name as stall_name, s.location as stall_location,
                u.name as student_name, u.email as student_email, u.campus_id as student_campus_id, u.phone as student_phone,
                p.method as payment_method, p.status as payment_status, p.transaction_ref as payment_ref, p.is_simulated
         FROM orders o
         JOIN food_stalls s ON s.id = o.stall_id
         JOIN users u ON u.id = o.student_id
         LEFT JOIN payments p ON p.order_id = o.id
         WHERE o.stall_id = ? ${whereStatus}
         ORDER BY o.created_at DESC`
      )
      .all(...params) as { id: string }[];

    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const enriched = orders.map((o) => ({
      ...o,
      items: itemsStmt.all(o.id),
    }));

    res.json({ orders: enriched });
  } catch (err) {
    next(err);
  }
});

// Admin: view all orders across platform
router.get('/all', requireAuth, requireRole('admin'), (req, res, next) => {
  try {
    const db = getDb();
    const { status, stallId } = req.query;
    const conditions: string[] = [];
    const params: string[] = [];

    if (typeof status === 'string' && status && status !== 'All') {
      conditions.push('o.status = ?');
      params.push(status);
    }
    if (typeof stallId === 'string' && stallId && stallId !== 'All') {
      conditions.push('o.stall_id = ?');
      params.push(stallId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const orders = db
      .prepare(
        `SELECT o.*, s.name as stall_name, s.location as stall_location,
                u.name as student_name, u.email as student_email, u.campus_id as student_campus_id,
                p.method as payment_method, p.status as payment_status, p.transaction_ref as payment_ref, p.is_simulated
         FROM orders o
         JOIN food_stalls s ON s.id = o.stall_id
         JOIN users u ON u.id = o.student_id
         LEFT JOIN payments p ON p.order_id = o.id
         ${whereClause}
         ORDER BY o.created_at DESC`
      )
      .all(...params) as { id: string }[];

    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    res.json({
      orders: orders.map((o) => ({ ...o, items: itemsStmt.all(o.id) })),
    });
  } catch (err) {
    next(err);
  }
});

// Student/Vendor/Admin: single order details (with ownership check)
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const order = getOrderDetailsById(db, req.params.id) as
      | { student_id: string; vendor_id: string }
      | null;

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    if (
      req.user!.role === 'student' &&
      order.student_id !== req.user!.userId
    ) {
      throw new AppError('Access denied.', 403);
    }
    if (
      req.user!.role === 'vendor' &&
      order.vendor_id !== req.user!.userId
    ) {
      throw new AppError('Access denied.', 403);
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
});

// Student: cancel eligible order & restore stock
router.post('/:id/cancel', requireAuth, requireRole('student'), (req, res, next) => {
  try {
    const { reason } = z.object({ reason: z.string().max(250).optional() }).parse(req.body || {});
    const db = getDb();
    const updated = cancelOrderByStudent(db, {
      orderId: req.params.id,
      studentId: req.user!.userId,
      reason,
    });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

// Vendor or Admin: advance or reject order status
router.patch('/:id/status', requireAuth, requireRole('vendor', 'admin'), (req, res, next) => {
  try {
    const parsed = z
      .object({
        status: z.enum(['Accepted', 'Preparing', 'Ready', 'Completed', 'Rejected']),
        reason: z.string().max(250).optional(),
      })
      .parse(req.body);

    const db = getDb();
    const updated = updateOrderStatusByVendor(db, {
      orderId: req.params.id,
      actorUserId: req.user!.userId,
      actorRole: req.user!.role,
      nextStatus: parsed.status as OrderStatus,
      reason: parsed.reason,
    });

    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
