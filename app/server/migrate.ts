/**
 * Manual/CI migration entry point (`npm run db:migrate`). Connecting via
 * `getDb()` applies all pending drizzle migrations from `./drizzle` (see
 * db.server.ts); this opens every institution's database (`TENANTS`), or the one
 * at `DATABASE_URL`.
 */
import { migrateAllTenants } from "./db.server";

for (const path of migrateAllTenants()) console.log(`✓ LimeOnIt database migrated: ${path}`);
