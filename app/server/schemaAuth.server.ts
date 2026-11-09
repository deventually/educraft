import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Two-step verification with an authenticator app (P2-12). One row per account that started
 * a setup; `enabledAt` null = the setup waits for a first right code. `lastStep` is the last
 * accepted 30-second step, so a code works only once. Re-exported by `schema.server.ts`.
 */
export const twoFactor = sqliteTable("two_factor", {
  userId: text("user_id").primaryKey(),
  secret: text("secret").notNull(), // base32, 160 bits
  enabledAt: integer("enabled_at", { mode: "timestamp_ms" }),
  lastStep: integer("last_step").notNull().default(-1),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** Single-use recovery codes (P2-12), stored as a SHA-256 hash; `usedAt` set on use. */
export const recoveryCodes = sqliteTable(
  "recovery_codes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    codeHash: text("code_hash").notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("recovery_codes_user_idx").on(t.userId)],
);
