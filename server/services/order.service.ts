import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '../middleware/errorHandler.ts';
import { emitLowStockNotifications } from './inventory.service.ts';

export type OrderStatus =
  | 'Placed'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Completed'
  | 'Rejected'
  | 'Cancelled';

export const ALLOWED_VENDOR_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  Placed: ['Accepted', 'Rejected'],
  Accepted: ['Preparing', 'Rejected'],
  Preparing: ['Ready'],
  Ready: ['Completed'],
  Completed: [],
  Rejected: [],
  Cancelled: [],
};

export function calculateOrderTotals(
  subtotal: number,
  taxRatePercent: number,
  platformFeeFlat: number
): { subtotal: number; taxAmount: number; platformFee: number; totalAmount: number } {
  const cleanSubtotal = Number(subtotal.toFixed(2));
  const taxAmount = Number(((cleanSubtotal * taxRatePercent) / 100).toFixed(2));
  const platformFee = Number(platformFeeFlat.toFixed(2));
  const totalAmount = Number((cleanSubtotal + taxAmount + platformFee).toFixed(2));
  return { subtotal: cleanSubtotal, taxAmount, platformFee, totalAmount };
}

export function canStudentCancelOrder(
  status: string,
  cancellableCsv = 'Placed,Accepted'
): boolean {
  const allowed = cancellableCsv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(status);
}

export function isValidVendorTransition(current: OrderStatus, next: OrderStatus): boolean {
  return ALLOWED_VENDOR_TRANSITIONS[current]?.includes(next) ?? false;
}

function generateOrderCode(db: DatabaseSync): string {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  const seq = 1001 + countRow.count;
  const rand = Math.floor(10 + Math.random() * 90);
  return `CB-2026-${seq}${rand}`;
}

export interface OrderCartLineInput {
  menuItemId: string;
  quantity: number;
}

export interface PlaceOrderParams {
  studentId: string;
  studentName: string;
  items: OrderCartLineInput[];
  pickupTime: string;
  paymentMethod: string;
  specialInstructions?: string;
  idempotencyKey?: string;
}

export function placeOrdersAtomically(db: DatabaseSync, params: PlaceOrderParams) {
  if (!params.items || params.items.length === 0) {
    throw new AppError('Your cart is empty. Add at least one item before checking out.', 400);
  }

  // Merge duplicate menuItemId lines safely
  const mergedMap = new Map<string, number>();
  for (const line of params.items) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new AppError('Item quantity must be a positive whole number.', 400);
    }
    mergedMap.set(line.menuItemId, (mergedMap.get(line.menuItemId) || 0) + line.quantity);
  }

  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    // Check platform ordering policy
    const settings = db
      .prepare('SELECT * FROM platform_settings WHERE id = 1')
      .get() as
      | {
          tax_rate_percent: number;
          platform_fee_flat: number;
          allow_ordering: number;
        }
      | undefined;

    if (settings && !settings.allow_ordering) {
      throw new AppError('Campus food ordering is temporarily paused by administration.', 503);
    }

    // Idempotency guard against duplicate submission & duplicate stock deduction
    if (params.idempotencyKey) {
      const existing = db
        .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
        .get(params.idempotencyKey) as { id: string; order_code: string } | undefined;
      if (existing) {
        db.exec('COMMIT');
        return { orders: [getOrderDetailsById(db, existing.id)], deduplicated: true };
      }
    }

    // Fetch all requested menu items and group by stall
    interface LoadedItem {
      id: string;
      stall_id: string;
      stall_name: string;
      vendor_id: string;
      stall_is_open: number;
      stall_is_active: number;
      name: string;
      price: number;
      stock_qty: number;
      low_stock_threshold: number;
      is_available: number;
      requestedQty: number;
    }

    const byStall = new Map<string, LoadedItem[]>();
    const fetchItemStmt = db.prepare(`
      SELECT m.*, s.name as stall_name, s.vendor_id, s.is_open as stall_is_open, s.is_active as stall_is_active
      FROM menu_items m
      JOIN food_stalls s ON s.id = m.stall_id
      WHERE m.id = ?
    `);

    for (const [menuItemId, requestedQty] of mergedMap.entries()) {
      const row = fetchItemStmt.get(menuItemId) as Omit<LoadedItem, 'requestedQty'> | undefined;
      if (!row) {
        throw new AppError('One of the items in your cart no longer exists.', 404);
      }
      if (!row.stall_is_active || !row.stall_is_open) {
        throw new AppError(`${row.stall_name} is currently closed and not accepting orders.`, 409);
      }
      if (!row.is_available) {
        throw new AppError(`${row.name} is currently marked unavailable by the vendor.`, 409);
      }
      if (row.stock_qty < requestedQty) {
        throw new AppError(
          `Insufficient stock for ${row.name}. Only ${row.stock_qty} unit(s) available.`,
          409
        );
      }

      const list = byStall.get(row.stall_id) || [];
      list.push({ ...row, requestedQty });
      byStall.set(row.stall_id, list);
    }

    const taxRate = settings?.tax_rate_percent ?? 5.0;
    const flatFee = settings?.platform_fee_flat ?? 5.0;

    const deductStmt = db.prepare(`
      UPDATE menu_items
      SET stock_qty = stock_qty - ?, updated_at = ?
      WHERE id = ? AND stock_qty >= ? AND is_available = 1
    `);

    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        id, order_code, student_id, stall_id, subtotal, tax_amount, platform_fee, total_amount,
        status, pickup_time, special_instructions, cancellation_reason, idempotency_key,
        inventory_deducted, inventory_restored, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Placed', ?, ?, '', ?, 1, 0, ?, ?)
    `);

    const insertOrderItemStmt = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, item_name, unit_price, quantity, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertPaymentStmt = db.prepare(`
      INSERT INTO payments (id, order_id, student_id, amount, method, status, transaction_ref, is_simulated, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Paid (Simulated)', ?, 1, ?, ?)
    `);

    const insertInvTxStmt = db.prepare(`
      INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
      VALUES (?, ?, ?, 'order_deduction', ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertNotifStmt = db.prepare(`
      INSERT INTO notifications (id, user_id, role_target, type, title, message, reference_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);

    const createdOrderIds: string[] = [];
    let stallIdx = 0;

    for (const [stallId, stallItems] of byStall.entries()) {
      const subtotal = stallItems.reduce((sum, it) => sum + it.price * it.requestedQty, 0);
      const totals = calculateOrderTotals(subtotal, taxRate, flatFee);
      const orderId = `ord_${crypto.randomUUID()}`;
      const orderCode = generateOrderCode(db);
      const idemKey = params.idempotencyKey
        ? stallIdx === 0
          ? params.idempotencyKey
          : `${params.idempotencyKey}:${stallId}`
        : null;
      stallIdx += 1;

      insertOrderStmt.run(
        orderId,
        orderCode,
        params.studentId,
        stallId,
        totals.subtotal,
        totals.taxAmount,
        totals.platformFee,
        totals.totalAmount,
        params.pickupTime,
        params.specialInstructions?.trim() || '',
        idemKey,
        now,
        now
      );

      for (const item of stallItems) {
        // Atomic conditional stock deduction (prevents overselling under concurrency)
        const deductRes = deductStmt.run(item.requestedQty, now, item.id, item.requestedQty);
        if (deductRes.changes !== 1) {
          throw new AppError(
            `Concurrent stock conflict for ${item.name}. Please refresh menu availability.`,
            409
          );
        }

        const newQty = item.stock_qty - item.requestedQty;
        const lineTotal = Number((item.price * item.requestedQty).toFixed(2));

        insertOrderItemStmt.run(
          `oi_${crypto.randomUUID()}`,
          orderId,
          item.id,
          item.name,
          item.price,
          item.requestedQty,
          lineTotal
        );

        insertInvTxStmt.run(
          `inv_${crypto.randomUUID()}`,
          item.id,
          stallId,
          item.stock_qty,
          -item.requestedQty,
          newQty,
          orderCode,
          `Deducted for order ${orderCode}`,
          params.studentId,
          now
        );

        if (newQty <= item.low_stock_threshold) {
          emitLowStockNotifications(db, {
            menuItemId: item.id,
            itemName: item.name,
            stallId,
            stallName: item.stall_name,
            vendorId: item.vendor_id,
            newQty,
            threshold: item.low_stock_threshold,
          });
        }
      }

      const payRef = `SIM-PAY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      insertPaymentStmt.run(
        `pay_${crypto.randomUUID()}`,
        orderId,
        params.studentId,
        totals.totalAmount,
        params.paymentMethod || 'UPI (Simulated)',
        payRef,
        now,
        now
      );

      const firstStall = stallItems[0];
      insertNotifStmt.run(
        `ntf_${crypto.randomUUID()}`,
        firstStall.vendor_id,
        'vendor',
        'new_order',
        `New Order ${orderCode}`,
        `${params.studentName} ordered ${stallItems.map((i) => `${i.requestedQty}x ${i.name}`).join(', ')} (Pickup: ${params.pickupTime}).`,
        orderId,
        now
      );

      createdOrderIds.push(orderId);
    }

    db.exec('COMMIT');
    return {
      orders: createdOrderIds.map((id) => getOrderDetailsById(db, id)),
      deduplicated: false,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function restoreOrderInventoryInsideTx(
  db: DatabaseSync,
  order: { id: string; order_code: string; stall_id: string; inventory_deducted: number; inventory_restored: number },
  txType: 'cancellation_restore' | 'rejection_restore',
  actorUserId: string,
  note: string,
  now: string
): void {
  // Duplicate restoration guard
  if (!order.inventory_deducted || order.inventory_restored) {
    return;
  }

  const orderItems = db
    .prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?')
    .all(order.id) as { menu_item_id: string; quantity: number }[];

  const getItemStmt = db.prepare('SELECT stock_qty FROM menu_items WHERE id = ?');
  const restoreItemStmt = db.prepare('UPDATE menu_items SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?');
  const insertInvTxStmt = db.prepare(`
    INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const line of orderItems) {
    const current = getItemStmt.get(line.menu_item_id) as { stock_qty: number } | undefined;
    if (!current) continue;
    restoreItemStmt.run(line.quantity, now, line.menu_item_id);
    insertInvTxStmt.run(
      `inv_${crypto.randomUUID()}`,
      line.menu_item_id,
      order.stall_id,
      txType,
      current.stock_qty,
      line.quantity,
      current.stock_qty + line.quantity,
      order.order_code,
      note,
      actorUserId,
      now
    );
  }

  db.prepare('UPDATE orders SET inventory_restored = 1, updated_at = ? WHERE id = ?').run(now, order.id);
}

export function cancelOrderByStudent(
  db: DatabaseSync,
  params: { orderId: string; studentId: string; reason?: string }
) {
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const order = db
      .prepare(
        `SELECT o.*, s.vendor_id, s.name as stall_name
         FROM orders o
         JOIN food_stalls s ON s.id = o.stall_id
         WHERE o.id = ?`
      )
      .get(params.orderId) as
      | {
          id: string;
          order_code: string;
          student_id: string;
          stall_id: string;
          vendor_id: string;
          stall_name: string;
          status: OrderStatus;
          inventory_deducted: number;
          inventory_restored: number;
        }
      | undefined;

    if (!order) {
      throw new AppError('Order not found.', 404);
    }
    if (order.student_id !== params.studentId) {
      throw new AppError('You can only cancel your own orders.', 403);
    }

    const settings = db
      .prepare('SELECT cancellable_statuses FROM platform_settings WHERE id = 1')
      .get() as { cancellable_statuses: string } | undefined;
    const cancellable = settings?.cancellable_statuses || 'Placed,Accepted';

    if (!canStudentCancelOrder(order.status, cancellable)) {
      throw new AppError(
        `Order ${order.order_code} is already "${order.status}" and can no longer be cancelled. Cancellation is permitted only while status is ${cancellable.replace(/,/g, ' or ')}.`,
        409
      );
    }

    const reason = params.reason?.trim() || 'Cancelled by student before preparation';
    db.prepare(
      `UPDATE orders SET status = 'Cancelled', cancellation_reason = ?, updated_at = ? WHERE id = ?`
    ).run(reason, now, order.id);

    restoreOrderInventoryInsideTx(
      db,
      order,
      'cancellation_restore',
      params.studentId,
      `Stock restored on student cancellation of ${order.order_code}`,
      now
    );

    db.prepare(
      `UPDATE payments SET status = 'Refunded (Simulated)', updated_at = ? WHERE order_id = ?`
    ).run(now, order.id);

    db.prepare(
      `INSERT INTO notifications (id, user_id, role_target, type, title, message, reference_id, is_read, created_at)
       VALUES (?, ?, 'vendor', 'order_update', ?, ?, ?, 0, ?)`
    ).run(
      `ntf_${crypto.randomUUID()}`,
      order.vendor_id,
      `Order ${order.order_code} Cancelled`,
      `The student cancelled order ${order.order_code}. Reserved inventory has been restored automatically.`,
      order.id,
      now
    );

    db.exec('COMMIT');
    return getOrderDetailsById(db, order.id);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function updateOrderStatusByVendor(
  db: DatabaseSync,
  params: {
    orderId: string;
    actorUserId: string;
    actorRole: string;
    nextStatus: OrderStatus;
    reason?: string;
  }
) {
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const order = db
      .prepare(
        `SELECT o.*, s.vendor_id, s.name as stall_name
         FROM orders o
         JOIN food_stalls s ON s.id = o.stall_id
         WHERE o.id = ?`
      )
      .get(params.orderId) as
      | {
          id: string;
          order_code: string;
          student_id: string;
          stall_id: string;
          vendor_id: string;
          stall_name: string;
          status: OrderStatus;
          inventory_deducted: number;
          inventory_restored: number;
        }
      | undefined;

    if (!order) {
      throw new AppError('Order not found.', 404);
    }

    if (params.actorRole === 'vendor' && order.vendor_id !== params.actorUserId) {
      throw new AppError('You can only manage orders for your own stall.', 403);
    }

    if (!isValidVendorTransition(order.status, params.nextStatus)) {
      throw new AppError(
        `Invalid status transition from "${order.status}" to "${params.nextStatus}".`,
        409
      );
    }

    const reason =
      params.nextStatus === 'Rejected'
        ? params.reason?.trim() || 'Rejected by vendor due to kitchen capacity'
        : '';

    db.prepare(
      `UPDATE orders SET status = ?, cancellation_reason = CASE WHEN ? != '' THEN ? ELSE cancellation_reason END, updated_at = ? WHERE id = ?`
    ).run(params.nextStatus, reason, reason, now, order.id);

    if (params.nextStatus === 'Rejected') {
      restoreOrderInventoryInsideTx(
        db,
        order,
        'rejection_restore',
        params.actorUserId,
        `Stock restored after vendor rejected ${order.order_code}`,
        now
      );
      db.prepare(
        `UPDATE payments SET status = 'Refunded (Simulated)', updated_at = ? WHERE order_id = ?`
      ).run(now, order.id);
    }

    const studentMsg =
      params.nextStatus === 'Ready'
        ? `Your order ${order.order_code} from ${order.stall_name} is ready for pickup!`
        : params.nextStatus === 'Rejected'
          ? `Order ${order.order_code} was declined by ${order.stall_name}. Simulated payment has been refunded.`
          : `Order ${order.order_code} from ${order.stall_name} is now ${params.nextStatus}.`;

    db.prepare(
      `INSERT INTO notifications (id, user_id, role_target, type, title, message, reference_id, is_read, created_at)
       VALUES (?, ?, 'student', 'order_update', ?, ?, ?, 0, ?)`
    ).run(
      `ntf_${crypto.randomUUID()}`,
      order.student_id,
      `Order ${order.order_code}: ${params.nextStatus}`,
      studentMsg,
      order.id,
      now
    );

    db.exec('COMMIT');
    return getOrderDetailsById(db, order.id);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getOrderDetailsById(db: DatabaseSync, orderId: string) {
  const order = db
    .prepare(
      `SELECT o.*, s.name as stall_name, s.location as stall_location, s.vendor_id,
              u.name as student_name, u.email as student_email, u.campus_id as student_campus_id,
              p.method as payment_method, p.status as payment_status, p.transaction_ref as payment_ref, p.is_simulated
       FROM orders o
       JOIN food_stalls s ON s.id = o.stall_id
       JOIN users u ON u.id = o.student_id
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.id = ?`
    )
    .get(orderId) as Record<string, unknown> | undefined;

  if (!order) return null;

  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .all(orderId);

  return {
    ...order,
    items,
  };
}
