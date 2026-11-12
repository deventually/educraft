/**
 * Ops script: one backup of the database now, while the app keeps running.
 *
 *   npm run backup                 (dev: tsx)
 *   node build/ops/backup.js       (production image)
 *
 * Goes to BACKUP_DIR, else `backups/` next to the database, and rotates (7 days, 4 weeks).
 * With several institutions (TENANTS), name one: `LIMEONIT_TENANT=hhs npm run backup`; its
 * backup goes to its own folder (`backups/hhs/`).
 * Relative imports (not the `~` alias) keep it runnable under plain tsx.
 */
import { dirname, join } from "node:path";
import { runBackup, tenantBackupDir } from "../app/server/backup.server";
import { allTenants, currentTenant } from "../app/server/tenants.server";

const tenant = currentTenant();
const dir =
  tenantBackupDir(process.env, tenant) ??
  join(dirname(tenant.dbPath), "backups", ...(allTenants().length > 1 ? [tenant.id] : []));
const { file, removed } = await runBackup({ dir });
console.log(`✓ Backup made: ${file}`);
if (removed.length > 0) console.log(`  Rotated away: ${removed.join(", ")}`);
