import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.server";
import { DB_PATH, env } from "./env.server";

/**
 * Local-first SQLite behind a `getDb()` seam.
 *
 * The schema is created and evolved by real drizzle-kit migrations (in
 * `./drizzle`), applied automatically on first connect. A `globalThis` cache
 * prevents duplicate connections under Vite HMR in dev.
 *
 * `getDb()` (not a `db` const) is the single access point: today it returns the
 * lazily-created singleton, but the indirection keeps the door open for a hosted
 * database-per-tenant model that resolves a different handle per request.
 */
export type Db = ReturnType<typeof createDb>;

function createDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(env.MIGRATIONS_DIR) });
  return db;
}

const globalForDb = globalThis as unknown as { __limeonitDb?: Db };

/** The single DB access point. All repositories call this at use time. */
export function getDb(): Db {
  if (!globalForDb.__limeonitDb) {
    globalForDb.__limeonitDb = createDb();
  }
  return globalForDb.__limeonitDb;
}
