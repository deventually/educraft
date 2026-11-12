import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * A division of the institution (BESLUIT-2026-11-12-2): the layer between the institution (the
 * environment itself, one database) and its programmes. The institution names the layer
 * (faculty, academy, location, …; `~/lib/organisation/kinds`); a programme sits under at most
 * one division (`programmes.division_id`). Managed by an admin; holds no one's content.
 * Re-exported by `schema.server.ts`.
 */
export const divisions = sqliteTable("divisions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
