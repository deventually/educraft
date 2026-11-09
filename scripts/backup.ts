/**
 * Ops script: one backup of the database now, while the app keeps running.
 *
 *   npm run backup                 (dev: tsx)
 *   node build/ops/backup.js       (production image)
 *
 * Goes to BACKUP_DIR, else `backups/` next to the database, and rotates (7 days, 4 weeks).
 * Relative imports (not the `~` alias) keep it runnable under plain tsx.
 */
import { dirname, join } from "node:path";
import { backupDir, runBackup } from "../app/server/backup.server";
import { DB_PATH } from "../app/server/env.server";

const dir = backupDir(process.env, DB_PATH) ?? join(dirname(DB_PATH), "backups");
const { file, removed } = await runBackup({ dir });
console.log(`✓ Backup made: ${file}`);
if (removed.length > 0) console.log(`  Rotated away: ${removed.join(", ")}`);
