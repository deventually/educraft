import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * An announcement from the admin, shown as a banner in the shell. `audience` is "all", "team"
 * or "user"; `targetId` is the team's or person's id (null for "all"). `endsOn` is the last
 * day it shows (`YYYY-MM-DD`, Europe/Amsterdam, inclusive) or null; `remindAfterDays` is how
 * long a dismissed announcement stays away, null = for good. Re-exported by `schema.server.ts`.
 */
export const announcements = sqliteTable(
  "announcements",
  {
    id: text("id").primaryKey(),
    message: text("message").notNull(),
    level: text("level").notNull(),
    audience: text("audience").notNull(),
    targetId: text("target_id"),
    endsOn: text("ends_on"),
    remindAfterDays: integer("remind_after_days"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("announcements_target_idx").on(t.audience, t.targetId)],
);

/**
 * A user closed an announcement. `hiddenUntil` is the first day it shows again
 * (`YYYY-MM-DD`), or null when it stays away. One row per (announcement, user).
 */
export const announcementDismissals = sqliteTable(
  "announcement_dismissals",
  {
    announcementId: text("announcement_id").notNull(),
    userId: text("user_id").notNull(),
    hiddenUntil: text("hidden_until"),
    dismissedAt: integer("dismissed_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.announcementId, t.userId] }),
    index("announcement_dismissals_user_idx").on(t.userId),
  ],
);
