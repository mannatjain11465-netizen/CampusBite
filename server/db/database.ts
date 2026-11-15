import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config/env.ts';

let dbInstance: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const targetPath = customPath || config.dbPath;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  initializeSchema(db);
  dbInstance = db;
  return dbInstance;
}

export function resetDbInstanceForTest(customPath = ':memory:'): DatabaseSync {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors during test reset
    }
    dbInstance = null;
  }
  return getDb(customPath);
}

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'vendor', 'admin')),
      campus_id TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

    CREATE TABLE IF NOT EXISTS food_stalls (
      id TEXT PRIMARY KEY,
      vendor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      cuisine_type TEXT NOT NULL,
      location TEXT NOT NULL,
      opening_hours TEXT NOT NULL,
      avg_prep_minutes INTEGER NOT NULL DEFAULT 12,
      rating REAL NOT NULL DEFAULT 4.7,
      image_url TEXT NOT NULL,
      is_open INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_stalls_vendor_id ON food_stalls(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_stalls_is_active ON food_stalls(is_active);

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      stall_id TEXT NOT NULL REFERENCES food_stalls(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      image_url TEXT NOT NULL,
      is_veg INTEGER NOT NULL DEFAULT 1,
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      prep_minutes INTEGER NOT NULL DEFAULT 10,
      stock_qty INTEGER NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
      low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      is_available INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_menu_stall_id ON menu_items(stall_id);
    CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);
    CREATE INDEX IF NOT EXISTS idx_menu_stock ON menu_items(stock_qty);

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_code TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL REFERENCES users(id),
      stall_id TEXT NOT NULL REFERENCES food_stalls(id),
      subtotal REAL NOT NULL,
      tax_amount REAL NOT NULL,
      platform_fee REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Placed', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Rejected', 'Cancelled')),
      pickup_time TEXT NOT NULL,
      special_instructions TEXT NOT NULL DEFAULT '',
      cancellation_reason TEXT NOT NULL DEFAULT '',
      idempotency_key TEXT UNIQUE,
      inventory_deducted INTEGER NOT NULL DEFAULT 0,
      inventory_restored INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
    CREATE INDEX IF NOT EXISTS idx_orders_stall_id ON orders(stall_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
      item_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Pending', 'Paid (Simulated)', 'Refunded (Simulated)', 'Failed')),
      transaction_ref TEXT NOT NULL UNIQUE,
      is_simulated INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      stall_id TEXT NOT NULL REFERENCES food_stalls(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('order_deduction', 'restock', 'cancellation_restore', 'rejection_restore', 'manual_adjustment')),
      previous_qty INTEGER NOT NULL,
      change_qty INTEGER NOT NULL,
      new_qty INTEGER NOT NULL,
      reference_id TEXT DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inv_tx_item ON inventory_transactions(menu_item_id);
    CREATE INDEX IF NOT EXISTS idx_inv_tx_stall ON inventory_transactions(stall_id);
    CREATE INDEX IF NOT EXISTS idx_inv_tx_created ON inventory_transactions(created_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_target TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('order_update', 'new_order', 'low_stock', 'system')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_id TEXT DEFAULT '',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notif_user_read ON notifications(user_id, is_read);

    CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      campus_name TEXT NOT NULL DEFAULT 'IIIT Allahabad Campus Food Court',
      tax_rate_percent REAL NOT NULL DEFAULT 5.0,
      platform_fee_flat REAL NOT NULL DEFAULT 5.0,
      allow_ordering INTEGER NOT NULL DEFAULT 1,
      cancellable_statuses TEXT NOT NULL DEFAULT 'Placed,Accepted',
      default_low_stock_threshold INTEGER NOT NULL DEFAULT 10,
      updated_at TEXT NOT NULL
    );
  `);

  db.prepare(
    "UPDATE platform_settings SET campus_name = 'IIIT Allahabad Campus Food Court' WHERE id = 1 AND campus_name LIKE '%Northbridge%'"
  ).run();
}
