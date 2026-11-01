import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { SEED_CATEGORIES, SEED_RULES } from "./seed-data";

const globalForDb = globalThis as unknown as { buzzfi?: Database.Database };

export function databasePath(): string {
  return process.env.BUZZFI_DATABASE ?? path.join(process.cwd(), "data", "buzzfi.db");
}

export function statementsRoot(): string {
  return process.env.BUZZFI_STATEMENTS ?? path.join(process.cwd(), "statements");
}

export function openDatabase(filename: string): Database.Database {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  seed(db);
  return db;
}

export function database(): Database.Database {
  if (!globalForDb.buzzfi) {
    globalForDb.buzzfi = openDatabase(databasePath());
  }
  return globalForDb.buzzfi;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      institution TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      folder_slug TEXT UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT REFERENCES categories(id),
      kind TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rules (
      id TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id),
      priority INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merchant_memory (
      merchant TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      header_signature TEXT NOT NULL UNIQUE,
      date_column TEXT NOT NULL,
      description_column TEXT NOT NULL,
      amount_column TEXT,
      debit_column TEXT,
      credit_column TEXT,
      balance_column TEXT,
      flip_sign INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statement_files (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      path TEXT NOT NULL,
      content_hash TEXT NOT NULL UNIQUE,
      period_start TEXT,
      period_end TEXT,
      ending_balance_cents INTEGER,
      profile_id TEXT,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      statement_file_id TEXT,
      posted_on TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      description TEXT NOT NULL,
      merchant TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id),
      trip_id TEXT REFERENCES trips(id),
      is_transfer INTEGER NOT NULL DEFAULT 0,
      fingerprint TEXT NOT NULL UNIQUE,
      review_status TEXT NOT NULL DEFAULT 'unreviewed',
      suggestion_source TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      as_of TEXT NOT NULL,
      balance_cents INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      month TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      UNIQUE(category_id, month)
    );

    CREATE INDEX IF NOT EXISTS idx_tx_posted ON transactions(posted_on);
    CREATE INDEX IF NOT EXISTS idx_tx_review ON transactions(review_status);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_trip ON transactions(trip_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_account ON balance_snapshots(account_id, as_of);
  `);
}

function seed(db: Database.Database) {
  const existing = db.prepare("SELECT value FROM meta WHERE key = 'seed'").get() as
    | { value: string }
    | undefined;
  if (existing) return;

  const now = new Date().toISOString();
  const insertCategory = db.prepare(
    `INSERT INTO categories (id, name, parent_id, kind, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const insertRule = db.prepare(
    `INSERT INTO rules (id, pattern, category_id, priority, created_at) VALUES (?, ?, ?, ?, ?)`,
  );

  const run = db.transaction(() => {
    for (const category of SEED_CATEGORIES) {
      insertCategory.run(category.id, category.name, category.parentId, category.kind, now);
    }
    SEED_RULES.forEach((rule, index) => {
      insertRule.run(`rule_seed_${index}`, rule.pattern, rule.categoryId, rule.priority, now);
    });
    db.prepare("INSERT INTO meta (key, value) VALUES ('seed', '1')").run();
  });
  run();
}
