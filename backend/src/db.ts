import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'property_repair.db');
const db: Database.Database = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      real_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL CHECK(role IN ('resident', 'frontdesk', 'technician')),
      building TEXT,
      room TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS repair_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      resident_id INTEGER NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('plumbing', 'civil', 'elevator', 'access', 'public')),
      description TEXT NOT NULL,
      expected_date TEXT NOT NULL,
      expected_slot TEXT NOT NULL CHECK(expected_slot IN ('morning', 'afternoon', 'evening')),
      status TEXT NOT NULL DEFAULT 'pending_assign' CHECK(status IN ('pending_assign', 'in_progress', 'rework', 'pending_confirm', 'dispute', 'closed')),
      technician_id INTEGER,
      assigned_at DATETIME,
      repair_result TEXT CHECK(repair_result IN ('fixed', 'revisit', 'parts_needed')),
      repair_note TEXT,
      repaired_at DATETIME,
      reject_count INTEGER DEFAULT 0,
      last_reject_reason TEXT,
      dispute_reason TEXT,
      closed_at DATETIME,
      rating INTEGER CHECK(rating IS NULL OR (rating >= 1 AND rating <= 5)),
      rating_comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      operation_idempotency_key TEXT,
      FOREIGN KEY (resident_id) REFERENCES users(id),
      FOREIGN KEY (technician_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      operation_type TEXT NOT NULL,
      operator_id INTEGER NOT NULL,
      idempotency_key TEXT UNIQUE,
      old_status TEXT,
      new_status TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES repair_orders(id),
      FOREIGN KEY (operator_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status ON repair_orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_resident ON repair_orders(resident_id);
    CREATE INDEX IF NOT EXISTS idx_orders_technician ON repair_orders(technician_id);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON repair_orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_idempotency ON operation_logs(idempotency_key);
  `);
}

initDatabase();

export default db;
