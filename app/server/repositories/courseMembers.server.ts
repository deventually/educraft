/**
 * Working on a course together (BESLUIT-2026-11-10-3). Repository rule, extended for
 * editors: the owner (`courses.user_id`) chooses editors among colleagues they share a team
 * with; an editor reads and changes the course's content through `courses.server.ts`.
 * Choosing editors, deleting, sharing and handing over stay with the owner, in the WHERE
 * clause. An editor may only remove themselves (`leaveCourse`).
 */
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { courseMembers, courses, teamMembers, users } from "../schema.server";

export interface CourseEditor {
  userId: string;
  name: string;
}

function ownsCourse(ownerId: string, courseId: string): boolean {
  return !!getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, ownerId)))
    .get();
}

/** Active colleagues who share at least one team with `userId`, by name; never `userId`. */
function teammates(userId: string): CourseEditor[] {
  return getDb()
    .selectDistinct({ userId: users.id, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        ne(teamMembers.userId, userId),
        isNull(users.disabledAt),
        sql`${teamMembers.teamId} in (select team_id from ${teamMembers} where user_id = ${userId})`,
      ),
    )
    .orderBy(asc(users.name))
    .all();
}

/** The owner's choice: a team-mate becomes editor. False (nothing written) otherwise. */
export async function addCourseEditor(
  ownerId: string,
  courseId: string,
  editorId: string,
): Promise<boolean> {
  if (!ownsCourse(ownerId, courseId)) return false;
  if (!teammates(ownerId).some((t) => t.userId === editorId)) return false;
  getDb()
    .insert(courseMembers)
    .values({ courseId, userId: editorId, role: "editor", createdAt: new Date() })
    .onConflictDoNothing()
    .run();
  return true;
}

/** The owner takes an editor off the course. Their own linked work stays theirs. */
export async function removeCourseEditor(
  ownerId: string,
  courseId: string,
  editorId: string,
): Promise<boolean> {
  if (!ownsCourse(ownerId, courseId)) return false;
  const result = getDb()
    .delete(courseMembers)
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, editorId)))
    .run();
  return result.changes > 0;
}

/** An editor stops working on a course. */
export async function leaveCourse(editorId: string, courseId: string): Promise<boolean> {
  const result = getDb()
    .delete(courseMembers)
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, editorId)))
    .run();
  return result.changes > 0;
}

/** The course's editors, by name; for its owner or one of its editors, empty otherwise. */
export async function listCourseEditors(
  viewerId: string,
  courseId: string,
): Promise<CourseEditor[]> {
  const rows = getDb()
    .select({ userId: users.id, name: users.name })
    .from(courseMembers)
    .innerJoin(users, eq(users.id, courseMembers.userId))
    .where(eq(courseMembers.courseId, courseId))
    .orderBy(asc(users.name))
    .all();
  const mayRead = ownsCourse(viewerId, courseId) || rows.some((r) => r.userId === viewerId);
  return mayRead ? rows : [];
}

/** Who the owner can still add: team-mates who are not yet editor. Empty for anyone else. */
export async function listEditorCandidates(
  ownerId: string,
  courseId: string,
): Promise<CourseEditor[]> {
  if (!ownsCourse(ownerId, courseId)) return [];
  const current = getDb()
    .select({ userId: courseMembers.userId })
    .from(courseMembers)
    .where(eq(courseMembers.courseId, courseId))
    .all()
    .map((r) => r.userId);
  return teammates(ownerId).filter((t) => !current.includes(t.userId));
}
