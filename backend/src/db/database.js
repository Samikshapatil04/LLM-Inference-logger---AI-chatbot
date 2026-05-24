import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = resolve(__dirname, '../../data');
const DB_PATH   = resolve(DATA_DIR, 'app.db');

let db = null;

export async function initDB() {
  const SQL = await initSqlJs();
  try { mkdirSync(DATA_DIR, { recursive: true }); } catch {}

  if (existsSync(DB_PATH)) {
    db = new SQL.Database(readFileSync(DB_PATH));
    console.log('✅ Database loaded from disk');
  } else {
    db = new SQL.Database();
    console.log('✅ Database created fresh');
  }

  createSchema();
  persistDB();
  return db;
}

function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL DEFAULT 'New Conversation',
      provider        TEXT NOT NULL DEFAULT 'gemini',
      model           TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      message_count   INTEGER DEFAULT 0,
      total_tokens    INTEGER DEFAULT 0,
      total_latency_ms INTEGER DEFAULT 0
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id               TEXT PRIMARY KEY,
      conversation_id  TEXT NOT NULL,
      role             TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
      content          TEXT NOT NULL,
      content_preview  TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS inference_logs (
      id                  TEXT PRIMARY KEY,
      conversation_id     TEXT NOT NULL,
      message_id          TEXT,
      provider            TEXT NOT NULL,
      model               TEXT NOT NULL,
      status              TEXT NOT NULL DEFAULT 'success',
      latency_ms          INTEGER,
      prompt_tokens       INTEGER,
      completion_tokens   INTEGER,
      total_tokens        INTEGER,
      input_preview       TEXT,
      output_preview      TEXT,
      error_message       TEXT,
      error_code          TEXT,
      is_streaming        INTEGER DEFAULT 0,
      request_id          TEXT,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      metadata            TEXT DEFAULT '{}',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv   ON messages(conversation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_conv       ON inference_logs(conversation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_logs_created    ON inference_logs(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conv_status     ON conversations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_conv_updated    ON conversations(updated_at)`);
}

export function persistDB() {
  if (!db) return;
  try {
    writeFileSync(DB_PATH, Buffer.from(db.export()));
  } catch (e) {
    console.error('DB persist error:', e.message);
  }
}

export function getDB() {
  if (!db) throw new Error('Database not initialised — call initDB() first');
  return db;
}

// Helper: run a query and return all rows
export function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

// Helper: run a query and return first row
export function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

// Auto-persist every 15 s
setInterval(() => { try { persistDB(); } catch {} }, 15000);
