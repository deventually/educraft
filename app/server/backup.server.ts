/**
 * Built-in database backup (P0 of the Doorlichting): no downtime, no external service.
 *
 * - `runBackup` copies the live SQLite file with the online backup API (`backupDbTo`), writes it
 *   under a `.partial` name first so a half copy never counts, then rotates.
 * - Rotation keeps the newest backup of each of the last 7 days and of each of the last 4 weeks,
 *   and always the newest one. Files it did not name are never touched.
 * - `startBackupSchedule` lets the running app make one backup a day by itself (hourly check).
 * - `restoreBackup` (ops script, app stopped) checks a backup and puts it in place, keeping the
 *   database it replaces aside.
 *
 * Where: `BACKUP_DIR`, else `backups/` next to the database in production; `BACKUP_DIR=off`
 * turns the daily backup off. With several institutions (`TENANTS`) each gets its own folder
 * inside it (`backups/<id>/`), so one folder still holds every backup and a restore touches one
 * institution only. Copying the folder off the server stays the host's job.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { assertSoundDatabaseFile, backupDbTo } from "./db.server";
import { log } from "./log.server";
import { servedTenants, runWithTenant, type Tenant } from "./tenants.server";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const KEEP_DAYS = 7;
const KEEP_WEEKS = 4;
const NAME = /^limeonit-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.db$/;

/** `limeonit-2026-11-09T03-04-05Z.db`: sortable, UTC, safe on every filesystem. */
export function backupFileName(now: Date): string {
  const iso = now.toISOString().slice(0, 19).replace(/:/g, "-");
  return `limeonit-${iso}Z.db`;
}

function parseBackupTime(name: string): number | null {
  const m = NAME.exec(name);
  return m ? Date.parse(`${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`) : null;
}

/** Monday-based week number since the epoch (1970-01-01 was a Thursday). */
const weekOf = (t: number) => Math.floor((Math.floor(t / DAY) + 3) / 7);

/** The file names rotation keeps; everything else among `names` may go. */
export function backupsToKeep(names: string[], now: Date): string[] {
  const ours = names
    .map((name) => ({ name, t: parseBackupTime(name) }))
    .filter((b): b is { name: string; t: number } => b.t !== null)
    .sort((a, b) => b.t - a.t);
  const keep = new Set(names.filter((n) => parseBackupTime(n) === null));
  const [newest] = ours;
  if (newest) keep.add(newest.name);
  const days = new Set<number>();
  const weeks = new Set<number>();
  for (const { name, t } of ours) {
    const age = now.getTime() - t;
    const day = Math.floor(t / DAY);
    if (age < KEEP_DAYS * DAY && !days.has(day)) {
      days.add(day);
      keep.add(name);
    }
    if (age < KEEP_WEEKS * 7 * DAY && !weeks.has(weekOf(t))) {
      weeks.add(weekOf(t));
      keep.add(name);
    }
  }
  return names.filter((n) => keep.has(n));
}

/** When the newest backup among `names` was made, by its name; `null` without one. */
export function latestBackupTime(names: string[]): Date | null {
  const times = names.map(parseBackupTime).filter((t): t is number => t !== null);
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

/** Due when no backup is younger than a day. */
export function isBackupDue(names: string[], now: Date): boolean {
  const newest = latestBackupTime(names);
  return newest === null || now.getTime() - newest.getTime() >= DAY;
}

/** Where the daily backup goes, or `null` when it is off. Pure: env and path are passed in. */
export function backupDir(env: Record<string, string | undefined>, dbPath: string): string | null {
  if (dbPath === ":memory:" || dbPath.startsWith(":memory:")) return null;
  const configured = env.BACKUP_DIR?.trim();
  if (configured === "off") return null;
  if (configured) return configured;
  return env.NODE_ENV === "production" ? join(dirname(dbPath), "backups") : null;
}

/**
 * Where `tenant`'s daily backup goes, or `null` when it is off: the one backup folder, with a
 * folder per institution inside it as soon as institutions have their own addresses (`TENANTS`
 * or the platform).
 */
export function tenantBackupDir(
  env: Record<string, string | undefined>,
  tenant: Tenant,
): string | null {
  const dir = backupDir(env, tenant.dbPath);
  return dir && tenant.hosts.length > 0 ? join(dir, tenant.id) : dir;
}

const list = (dir: string) => (existsSync(dir) ? readdirSync(dir) : []);

/** When the newest backup in `dir` was made (for the admin's health overview). */
export const latestBackup = (dir: string): Date | null => latestBackupTime(list(dir));

export interface BackupResult {
  file: string;
  removed: string[];
}

/** One backup of the live database into `dir`, then rotation. */
export async function runBackup(opts: { dir: string; now?: Date }): Promise<BackupResult> {
  const now = opts.now ?? new Date();
  mkdirSync(opts.dir, { recursive: true });
  const file = join(opts.dir, backupFileName(now));
  const partial = `${file}.partial`;
  rmSync(partial, { force: true });
  try {
    await backupDbTo(partial);
    renameSync(partial, file);
  } catch (error) {
    rmSync(partial, { force: true });
    throw error;
  }
  const names = list(opts.dir);
  const keep = new Set(backupsToKeep(names, now));
  const removed = names.filter((n) => !keep.has(n) && parseBackupTime(n) !== null);
  for (const name of removed) rmSync(join(opts.dir, name), { force: true });
  return { file, removed };
}

/** A backup into `dir` when the newest one there is a day old; otherwise `null`. */
export async function backupIfDue(dir: string, now = new Date()): Promise<BackupResult | null> {
  if (!isBackupDue(list(dir), now)) return null;
  return runBackup({ dir, now });
}

/**
 * The daily backup of every institution that is due, each on its own database into its own
 * folder. One institution's failure is logged and never stops the next one.
 */
export async function backupAllTenantsIfDue(
  env: Record<string, string | undefined> = process.env,
  tenants: readonly Tenant[] = servedTenants(),
  now = new Date(),
): Promise<(BackupResult & { tenant: string })[]> {
  const done: (BackupResult & { tenant: string })[] = [];
  for (const tenant of tenants) {
    const dir = tenantBackupDir(env, tenant);
    if (!dir) continue;
    try {
      const result = await runWithTenant(tenant, () => backupIfDue(dir, now));
      if (!result) continue;
      log("backup.done", { tenant: tenant.id, file: result.file, removed: result.removed.length });
      done.push({ ...result, tenant: tenant.id });
    } catch (error) {
      log("backup.failed", {
        tenant: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return done;
}

const globalForBackup = globalThis as unknown as { __limeonitBackupTimer?: NodeJS.Timeout };

/**
 * Starts the app's own daily backup: a check now and every hour, never blocking a request and
 * never taking the app down (a failure is logged). Idempotent. Returns whether it runs.
 */
export function startBackupSchedule(
  env: Record<string, string | undefined> = process.env,
  tenants?: readonly Tenant[],
): boolean {
  // The platform's institutions change while the app runs: each tick reads the list anew.
  const now = () => tenants ?? servedTenants();
  if (!now().some((t) => tenantBackupDir(env, t)) && !env.PLATFORM_HOST) return false;
  if (globalForBackup.__limeonitBackupTimer) return true;
  const tick = () => void backupAllTenantsIfDue(env, now());
  globalForBackup.__limeonitBackupTimer = setInterval(tick, HOUR);
  globalForBackup.__limeonitBackupTimer.unref();
  tick();
  return true;
}

/**
 * Puts a backup in place of the database at `dbPath`. Run it with the app stopped. Refuses a
 * file that is not a sound database before touching anything; the database it replaces (with
 * its -wal/-shm) is kept aside as `<db>.before-restore-<time>` and returned as `previous`.
 */
export function restoreBackup(opts: { from: string; dbPath: string; now?: Date }): {
  previous: string | null;
} {
  assertSoundDatabaseFile(opts.from);
  const stamp = backupFileName(opts.now ?? new Date()).replace(/^limeonit-|\.db$/g, "");
  const incoming = `${opts.dbPath}.restoring`;
  copyFileSync(opts.from, incoming);
  let previous: string | null = null;
  if (existsSync(opts.dbPath)) {
    previous = `${opts.dbPath}.before-restore-${stamp}`;
    renameSync(opts.dbPath, previous);
  }
  for (const suffix of ["-wal", "-shm"]) {
    const side = `${opts.dbPath}${suffix}`;
    if (!existsSync(side)) continue;
    if (previous) renameSync(side, `${previous}${suffix}`);
    else rmSync(side, { force: true });
  }
  renameSync(incoming, opts.dbPath);
  return { previous };
}
