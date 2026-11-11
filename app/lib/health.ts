/**
 * The admin's health overview (P1): how old the newest backup is, how big the database is, how
 * much disk is left and which version runs. Computed on the server (`health.server.ts`), shown by `HealthPanel`.
 */

/** A backup older than this gets a warning on the admin page. */
export const BACKUP_STALE_HOURS = 36;

export type BackupHealth =
  | { state: "off" }
  | { state: "none" }
  | { state: "ok" | "stale"; at: string; ageHours: number };

export interface AdminHealth {
  backup: BackupHealth;
  /** The database file plus its write-ahead log; `null` when unknown (in memory). */
  databaseBytes: number | null;
  /** Free space for the database's folder; `null` when unknown. */
  freeDiskBytes: number | null;
  /** The running version (`package.json`), e.g. `1.2.0`. */
  version: string;
}
