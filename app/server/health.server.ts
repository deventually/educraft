import { statfsSync } from "node:fs";
import { dirname } from "node:path";
import { BACKUP_STALE_HOURS, type AdminHealth, type BackupHealth } from "~/lib/health";
import { latestBackup, tenantBackupDir } from "./backup.server";
import { databaseBytes } from "./db.server";
import { currentTenant, type Tenant } from "./tenants.server";
import { APP_VERSION } from "./version.server";

const HOUR = 60 * 60 * 1000;

const inMemory = (dbPath: string) => dbPath.startsWith(":memory:");

function backupHealth(dir: string | null, now: Date): BackupHealth {
  if (!dir) return { state: "off" };
  const newest = latestBackup(dir);
  if (!newest) return { state: "none" };
  const ageHours = Math.floor((now.getTime() - newest.getTime()) / HOUR);
  return {
    state: ageHours >= BACKUP_STALE_HOURS ? "stale" : "ok",
    at: newest.toISOString(),
    ageHours,
  };
}

function freeDiskBytes(dbPath: string): number | null {
  if (inMemory(dbPath)) return null;
  try {
    const s = statfsSync(dirname(dbPath));
    return s.bavail * s.bsize;
  } catch {
    return null;
  }
}

/** The admin's health overview, of the institution this request is for. Read-only: it looks at files, never changes anything. */
export function adminHealth(
  opts: {
    env?: Record<string, string | undefined>;
    dbPath?: string;
    now?: Date;
    tenants?: readonly Tenant[];
  } = {},
): AdminHealth {
  const env = opts.env ?? process.env;
  const tenant = currentTenant();
  const dbPath = opts.dbPath ?? tenant.dbPath;
  return {
    backup: backupHealth(
      tenantBackupDir(env, { ...tenant, dbPath }, opts.tenants),
      opts.now ?? new Date(),
    ),
    databaseBytes: databaseBytes(dbPath),
    freeDiskBytes: freeDiskBytes(dbPath),
    version: APP_VERSION,
  };
}
