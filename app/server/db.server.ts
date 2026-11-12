import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { sql } from "drizzle-orm";
import * as schema from "./schema.server";
import { env } from "./env.server";
import { allTenants, currentTenant, runWithTenant, type Tenant } from "./tenants.server";

/**
 * Local-first SQLite behind a `getDb()` seam.
 *
 * The schema is created and evolved by real drizzle-kit migrations (in
 * `./drizzle`), applied automatically on first connect. A `globalThis` cache
 * prevents duplicate connections under Vite HMR in dev.
 *
 * `getDb()` (not a `db` const) is the single access point: it opens the database of the
 * institution this code runs for (`currentTenant()`, tenants.server), once per institution, so
 * one process serves several institutions each on their own database. Without `TENANTS` that
 * is the one database at `DATABASE_URL`.
 */
export type Db = ReturnType<typeof createDb>;

function createDb(path: string) {
  if (!path.startsWith(":memory:")) mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve(env.MIGRATIONS_DIR) });
  return db;
}

const globalForDb = globalThis as unknown as { __limeonitDbs?: Map<string, Db> };

/** The DB access point. All repositories call this at use time. */
export function getDb(): Db {
  const tenant = currentTenant();
  globalForDb.__limeonitDbs ??= new Map();
  let db = globalForDb.__limeonitDbs.get(tenant.id);
  if (!db) {
    db = createDb(tenant.dbPath);
    globalForDb.__limeonitDbs.set(tenant.id, db);
  }
  return db;
}

/** Opens (and so migrates) every institution's database: at boot and from `db:migrate`. */
export function migrateAllTenants(tenants: readonly Tenant[] = allTenants()): string[] {
  return tenants.map((tenant) => {
    runWithTenant(tenant, getDb);
    return tenant.dbPath;
  });
}

/**
 * Trivial connectivity probe for the health endpoint, of every institution's database. Throws
 * if one is unreachable; returns nothing on success. Kept here so the raw-SQL access stays
 * behind the `db.server` seam.
 */
export function pingDb(tenants: readonly Tenant[] = allTenants()): void {
  for (const tenant of tenants) runWithTenant(tenant, () => getDb().get(sql`SELECT 1`));
}

/**
 * Bytes the database takes on disk: the file plus its write-ahead log. `null` for an in-memory or
 * missing database. For the admin's health overview.
 */
export function databaseBytes(path: string = currentTenant().dbPath): number | null {
  if (path.startsWith(":memory:") || !existsSync(path)) return null;
  const wal = `${path}-wal`;
  return statSync(path).size + (existsSync(wal) ? statSync(wal).size : 0);
}

/**
 * Online backup (P0, ingebouwde back-up): SQLite's backup API copies the live database page by
 * page while the app keeps reading and writing, so no downtime. The copy is then sealed as a
 * single self-contained file (rollback journal, no -wal/-shm beside it) and checked.
 */
export async function backupDbTo(destination: string): Promise<void> {
  await getDb().$client.backup(destination);
  const copy = new Database(destination, { fileMustExist: true });
  try {
    copy.pragma("journal_mode = DELETE");
    assertIntegrity(copy, destination);
  } finally {
    copy.close();
  }
}

/** Throws unless `path` is a sound SQLite database. Opens it read-only, beside the live one. */
export function assertSoundDatabaseFile(path: string): void {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    assertIntegrity(db, path);
  } finally {
    db.close();
  }
}

function assertIntegrity(db: Database.Database, path: string): void {
  const result = db.pragma("integrity_check", { simple: true });
  if (result !== "ok") throw new Error(`${path} failed the integrity check: ${String(result)}`);
}
