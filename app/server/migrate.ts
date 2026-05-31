/**
 * Connecting to the DB creates the schema (CREATE TABLE IF NOT EXISTS), so
 * "migrating" is just a connect. Kept as an explicit `npm run db:migrate` step
 * for clarity and CI.
 */
import { db } from "./db.server";
import { DB_PATH } from "./env.server";

// Touch the db so the module initializes and ensureSchema runs.
void db;
console.log(`✓ LimeOnIt database ready: ${DB_PATH}`);
