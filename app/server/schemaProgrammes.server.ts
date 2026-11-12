import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * A programme (opleiding) of a team (BESLUIT-2026-11-10-3): a named bundle of the members'
 * courses. The team lead or an admin manages it; every member reads it. `sector` and `track`
 * come from the context catalogue (`~/lib/context/sectors`), `form` is fulltime/parttime/dual.
 * `divisionId` is the division it sits under (faculty, location, …), set by an admin; null = none.
 * Re-exported by `schema.server.ts`.
 */
export const programmes = sqliteTable(
  "programmes",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    createdBy: text("created_by").notNull(),
    name: text("name").notNull(),
    sector: text("sector").notNull(),
    track: text("track"),
    form: text("form"),
    divisionId: text("division_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("programmes_team_idx").on(t.teamId),
    index("programmes_division_idx").on(t.divisionId),
  ],
);

/**
 * A course in a programme, with its study year and period there. `userId` is the course's
 * owner, who placed it; placing shares the course with the programme's team, and a placement
 * is only read while that share stands. One course can sit in several programmes (full-time
 * and part-time) at a different place in each.
 */
export const programmeCourses = sqliteTable(
  "programme_courses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    programmeId: text("programme_id").notNull(),
    courseId: text("course_id").notNull(),
    year: integer("year"),
    period: integer("period"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    uniqueIndex("programme_courses_programme_course").on(t.programmeId, t.courseId),
    index("programme_courses_course_idx").on(t.courseId),
    index("programme_courses_user_idx").on(t.userId),
  ],
);

/**
 * A learning line (leerlijn) in a programme: a named, ordered series of the programme's
 * courses (`courseIdsJson`, a JSON array of course ids in line order). Managed like its
 * programme (the team lead or an admin), read by every team member. Its overview is computed,
 * never stored (`~/lib/programmes/learningLine`).
 */
export const learningLines = sqliteTable(
  "learning_lines",
  {
    id: text("id").primaryKey(),
    programmeId: text("programme_id").notNull(),
    name: text("name").notNull(),
    courseIdsJson: text("course_ids_json").notNull().default("[]"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("learning_lines_programme_idx").on(t.programmeId)],
);
