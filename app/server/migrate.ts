/**
 * Manual/CI migration entry point (`npm run db:migrate`). Connecting via
 * `getDb()` applies all pending drizzle migrations from `./drizzle` (see
 * db.server.ts), so this is a thin, explicit trigger for that same migrator.
 */
import { getDb } from "./db.server";
import { DB_PATH } from "./env.server";

// Touch the db so the module initializes and migrations run.
getDb();
console.log(`✓ LimeOnIt database migrated: ${DB_PATH}`);
