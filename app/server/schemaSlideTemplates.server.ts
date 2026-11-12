import { blob, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A PowerPoint template of a teacher or a team (P30.7b): the uploaded file itself, checked at
 * the boundary (`checkPptxTemplate`), at most one per owner. `owner_kind` is "user" or "team";
 * `owner_id` the user's or the team's id. Re-exported by `schema.server.ts`.
 */
export const slideTemplates = sqliteTable(
  "slide_templates",
  {
    id: text("id").primaryKey(),
    ownerKind: text("owner_kind").notNull(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    data: blob("data", { mode: "buffer" }).notNull(),
    size: integer("size").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("slide_templates_owner_idx").on(t.ownerKind, t.ownerId)],
);
