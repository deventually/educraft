/**
 * Who works on which course, and how (BESLUIT-2026-11-10-5, BESLUIT-2026-11-16-2): the
 * course's own members (`course_members`) plus every member of a team linked to it
 * (`course_teams`), never its owner. A derived table for the WHERE clauses of the
 * repositories, with columns `course_id`, `user_id` and `role`; someone can be in it twice.
 * Because it is read live, who joins a linked team works on the course at once and who
 * leaves stops at once.
 */
import { sql } from "drizzle-orm";
import { courseMembers, courses, courseTeams, teamMembers } from "../schema.server";

export const courseRoles = sql`(select course_id, user_id, role from ${courseMembers}
  union all
  select ct.course_id, tm.user_id, ct.role from ${courseTeams} ct
    join ${teamMembers} tm on tm.team_id = ct.team_id
    join ${courses} owned on owned.id = ct.course_id and owned.user_id <> tm.user_id)`;
