import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * The editors of a course (BESLUIT-2026-11-10-5): colleagues the owner lets work on it. An
 * editor reads and changes the course's content; deleting, sharing, choosing editors and
 * handing it over stay with the owner (`courses.user_id`). `role` is "editor" for now, so a
 * later role needs no migration. Re-exported by `schema.server.ts`.
 */
export const courseMembers = sqliteTable(
  "course_members",
  {
    courseId: text("course_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("editor"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.userId] }),
    index("course_members_user_idx").on(t.userId),
  ],
);

/**
 * A whole team working on a course (BESLUIT-2026-11-16-2): every member of the team has `role`
 * on it, for as long as they are in the team. The course stays its owner's. Read together
 * with `course_members` through `courseRoles` (`repositories/courseRoles.server.ts`).
 */
export const courseTeams = sqliteTable(
  "course_teams",
  {
    courseId: text("course_id").notNull(),
    teamId: text("team_id").notNull(),
    role: text("role").notNull().default("editor"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.courseId, t.teamId] }),
    index("course_teams_team_idx").on(t.teamId),
  ],
);
