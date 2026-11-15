import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { AppError } from '../middleware/errorHandler.ts';

export function emitLowStockNotifications(
  db: DatabaseSync,
  params: {
    menuItemId: string;
    itemName: string;
    stallId: string;
    stallName: string;
    vendorId: string;
    newQty: number;
    threshold: number;
  }
): void {
  if (params.newQty > params.threshold) {
    return;
  }

  const now = new Date().toISOString();
  const title =
    params.newQty === 0
      ? `Out of stock: ${params.itemName}`
      : `Low stock alert: ${params.itemName}`;
  const message =
    params.newQty === 0
      ? `${params.itemName} at ${params.stallName} has reached 0 units and cannot be ordered until restocked.`
      : `${params.itemName} at ${params.stallName} has ${params.newQty} units left (threshold: ${params.threshold}).`;

  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, user_id, role_target, type, title, message, reference_id, is_read, created_at)
    VALUES (?, ?, ?, 'low_stock', ?, ?, ?, 0, ?)
  `);

  insertNotif.run(
    `ntf_${crypto.randomUUID()}`,
    params.vendorId,
    'vendor',
    title,
    message,
    params.menuItemId,
    now
  );
}

export function restockMenuItem(
  db: DatabaseSync,
  params: {
    menuItemId: string;
    actorUserId: string;
    actorRole: string;
    addQuantity: number;
    note?: string;
    makeAvailable?: boolean;
  }
) {
  if (!Number.isInteger(params.addQuantity) || params.addQuantity <= 0) {
    throw new AppError('Restock quantity must be a positive whole number.', 400);
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const item = db
      .prepare(
        `SELECT m.*, s.vendor_id, s.name as stall_name
         FROM menu_items m
         JOIN food_stalls s ON s.id = m.stall_id
         WHERE m.id = ?`
      )
      .get(params.menuItemId) as
      | {
          id: string;
          stall_id: string;
          name: string;
          stock_qty: number;
          low_stock_threshold: number;
          is_available: number;
          vendor_id: string;
          stall_name: string;
        }
      | undefined;

    if (!item) {
      throw new AppError('Menu item not found.', 404);
    }

    if (params.actorRole === 'vendor' && item.vendor_id !== params.actorUserId) {
      throw new AppError('You can only restock items belonging to your own food stall.', 403);
    }

    const previousQty = item.stock_qty;
    const newQty = previousQty + params.addQuantity;
    const nextAvailable = params.makeAvailable === false ? item.is_available : 1;

    db.prepare(
      'UPDATE menu_items SET stock_qty = ?, is_available = ?, updated_at = ? WHERE id = ?'
    ).run(newQty, nextAvailable, now, item.id);

    const txId = `inv_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
       VALUES (?, ?, ?, 'restock', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      txId,
      item.id,
      item.stall_id,
      previousQty,
      params.addQuantity,
      newQty,
      `RST-${Date.now().toString().slice(-6)}`,
      params.note?.trim() || 'Vendor inventory restock',
      params.actorUserId,
      now
    );

    db.exec('COMMIT');

    return {
      itemId: item.id,
      itemName: item.name,
      previousQty,
      addedQty: params.addQuantity,
      newQty,
      isAvailable: Boolean(nextAvailable),
      transactionId: txId,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function adjustMenuItemStock(
  db: DatabaseSync,
  params: {
    menuItemId: string;
    actorUserId: string;
    actorRole: string;
    newStockQty: number;
    note?: string;
  }
) {
  if (!Number.isInteger(params.newStockQty) || params.newStockQty < 0) {
    throw new AppError('Stock quantity must be a non-negative integer.', 400);
  }

  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const item = db
      .prepare(
        `SELECT m.*, s.vendor_id, s.name as stall_name
         FROM menu_items m
         JOIN food_stalls s ON s.id = m.stall_id
         WHERE m.id = ?`
      )
      .get(params.menuItemId) as
      | {
          id: string;
          stall_id: string;
          name: string;
          stock_qty: number;
          low_stock_threshold: number;
          vendor_id: string;
          stall_name: string;
        }
      | undefined;

    if (!item) {
      throw new AppError('Menu item not found.', 404);
    }

    if (params.actorRole === 'vendor' && item.vendor_id !== params.actorUserId) {
      throw new AppError('You can only adjust inventory for your own stall.', 403);
    }

    const previousQty = item.stock_qty;
    const changeQty = params.newStockQty - previousQty;

    db.prepare('UPDATE menu_items SET stock_qty = ?, updated_at = ? WHERE id = ?').run(
      params.newStockQty,
      now,
      item.id
    );

    const txId = `inv_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO inventory_transactions (id, menu_item_id, stall_id, type, previous_qty, change_qty, new_qty, reference_id, note, created_by, created_at)
       VALUES (?, ?, ?, 'manual_adjustment', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      txId,
      item.id,
      item.stall_id,
      previousQty,
      changeQty,
      params.newStockQty,
      `ADJ-${Date.now().toString().slice(-6)}`,
      params.note?.trim() || 'Manual stock count reconciliation',
      params.actorUserId,
      now
    );

    if (params.newStockQty <= item.low_stock_threshold) {
      emitLowStockNotifications(db, {
        menuItemId: item.id,
        itemName: item.name,
        stallId: item.stall_id,
        stallName: item.stall_name,
        vendorId: item.vendor_id,
        newQty: params.newStockQty,
        threshold: item.low_stock_threshold,
      });
    }

    db.exec('COMMIT');

    return {
      itemId: item.id,
      previousQty,
      newQty: params.newStockQty,
      changeQty,
      transactionId: txId,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
