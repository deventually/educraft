/**
 * The names the server gate knows (anonymiseerpoort PR 2, BESLUIT-2026-11-17-5): the teacher
 * themselves, everyone who shares a team with them, and everyone on a course they own or work on
 * (its owner, its members, the members of a linked team). Not the whole institution: the longer
 * the list, the more ordinary words are hit by mistake. Read-only and scoped to `userId`; former
 * colleagues stay, because their names still identify them.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { courses, teamMembers, users } from "../schema.server";
import { courseRoles } from "./courseRoles.server";

/** Enough for a big department; the gate matches every name in every call. */
const MAX_COLLEAGUES = 500;

export interface KnownNames {
  teacher?: string;
  colleagues: string[];
}

export async function listKnownPeople(userId: string): Promise<KnownNames> {
  const db = getDb();
  const self = db.select({ name: users.name }).from(users).where(eq(users.id, userId)).get();
  const myCourses = sql`(select ${courses.id} from ${courses} where ${courses.userId} = ${userId}
    union select r.course_id from ${courseRoles} r where r.user_id = ${userId})`;
  const circle = sql`(
    select ${teamMembers.userId} from ${teamMembers}
      where ${teamMembers.teamId} in (select team_id from ${teamMembers} where user_id = ${userId})
    union select ${courses.userId} from ${courses} where ${courses.id} in ${myCourses}
    union select r.user_id from ${courseRoles} r where r.course_id in ${myCourses})`;
  const colleagues = db
    .selectDistinct({ name: users.name })
    .from(users)
    .where(and(ne(users.id, userId), sql`${users.id} in ${circle}`))
    .orderBy(users.name)
    .limit(MAX_COLLEAGUES)
    .all()
    .map((r) => r.name);
  return { ...(self ? { teacher: self.name } : {}), colleagues };
}
