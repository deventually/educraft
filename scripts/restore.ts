/**
 * Ops script: put a backup back. Stop the app first.
 *
 *   npm run restore -- --from data/backups/limeonit-2026-11-09T02-00-00Z.db
 *   node build/ops/restore.js --from /data/backups/limeonit-….db
 *
 * Checks the backup before touching anything, then replaces the database (DATABASE_URL, or
 * `--to <file>`). The database it replaces is kept aside as `<db>.before-restore-<time>`.
 */
import { restoreBackup } from "../app/server/backup.server";
import { DB_PATH } from "../app/server/env.server";

function argument(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

const from = argument("from");
if (!from) {
  console.error("Missing --from. Usage: npm run restore -- --from <backup file>  (stop the app first)");
  process.exit(1);
}
const dbPath = argument("to") ?? DB_PATH;

try {
  const { previous } = restoreBackup({ from, dbPath });
  console.log(`✓ Restored ${from} to ${dbPath}.`);
  if (previous) console.log(`  The database it replaced is kept as ${previous}.`);
  console.log("  Start the app again.");
} catch (error) {
  console.error(`Not restored: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
