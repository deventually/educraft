import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.server";
import { DB_PATH } from "./env.server";

/**
 * Local-first SQLite. Tables are created on first connect (CREATE TABLE IF NOT
 * EXISTS) so there is no migration step to run for the MVP. Drizzle provides the
 * typed query layer. A globalThis cache prevents duplicate connections under
 * Vite HMR in dev.
 */
function createDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  return drizzle(sqlite, { schema });
}

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      tool_slug TEXT NOT NULL,
      stage_id TEXT,
      model TEXT NOT NULL,
      input_json TEXT NOT NULL,
      context_profile_id TEXT,
      output_language TEXT NOT NULL DEFAULT 'nl',
      output_markdown TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      tool_slug TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      model TEXT NOT NULL,
      context_profile_id TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS context_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
  `);
}

const globalForDb = globalThis as unknown as { __educraftDb?: ReturnType<typeof createDb> };

export const db = globalForDb.__educraftDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__educraftDb = db;
