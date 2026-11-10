/**
 * Working on a course together (BESLUIT-2026-11-10-3). Repository rule, extended for
 * members: besides its owner (`courses.user_id`) a course has editors and co-owners
 * (`course_members.role`). Both read and change the course's content through
 * `courses.server.ts`. The owner and the co-owners *manage* the course: they share it and
 * choose its members, among colleagues they share a team with. Deleting, the context profile
 * and handing over stay with the owner. A member may always remove themselves.
 */
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "../db.server";
import { courseMembers, courses, shares, teamMembers, users } from "../schema.server";

export const COURSE_ROLES = ["editor", "co-owner"] as const;
export type CourseRole = (typeof COURSE_ROLES)[number];

export interface CourseMember {
  userId: string;
  name: string;
  role: CourseRole;
}

export interface Colleague {
  userId: string;
  name: string;
}

/** Someone who no longer co-owns the course: the shares they made of it go. */
function dropSharesBy(userId: string, courseId: string): void {
  getDb()
    .delete(shares)
    .where(
      and(eq(shares.kind, "course"), eq(shares.itemId, courseId), eq(shares.ownerUserId, userId)),
    )
    .run();
}

const isRole = (role: string): role is CourseRole =>
  (COURSE_ROLES as readonly string[]).includes(role);

/** The owner or a co-owner of the course. */
function managesCourse(userId: string, courseId: string): boolean {
  return !!getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        sql`(${courses.userId} = ${userId} or exists (select 1 from ${courseMembers} m
          where m.course_id = ${courses.id} and m.user_id = ${userId} and m.role = 'co-owner'))`,
      ),
    )
    .get();
}

function ownerOf(courseId: string): string | null {
  return (
    getDb().select({ ownerId: courses.userId }).from(courses).where(eq(courses.id, courseId)).get()
      ?.ownerId ?? null
  );
}

/** Active colleagues who share at least one team with `userId`, by name; never `userId`. */
function teammates(userId: string): Colleague[] {
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

/**
 * A manager makes a team-mate an editor or co-owner, or changes their role. False (nothing
 * written) when the caller does not manage the course, the colleague shares no team with the
 * caller, or the colleague is the owner.
 */
export async function setCourseMember(
  callerId: string,
  courseId: string,
  userId: string,
  role: CourseRole,
): Promise<boolean> {
  if (!isRole(role) || !managesCourse(callerId, courseId)) return false;
  if (userId === ownerOf(courseId)) return false;
  if (!teammates(callerId).some((t) => t.userId === userId)) return false;
  getDb()
    .insert(courseMembers)
    .values({ courseId, userId, role, createdAt: new Date() })
    .onConflictDoUpdate({ target: [courseMembers.courseId, courseMembers.userId], set: { role } })
    .run();
  if (role !== "co-owner") dropSharesBy(userId, courseId);
  return true;
}

/** A manager takes a member off the course. Their own linked work stays theirs. */
export async function removeCourseMember(
  callerId: string,
  courseId: string,
  userId: string,
): Promise<boolean> {
  if (!managesCourse(callerId, courseId)) return false;
  const result = getDb()
    .delete(courseMembers)
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, userId)))
    .run();
  dropSharesBy(userId, courseId);
  return result.changes > 0;
}

/** A member stops working on a course. */
export async function leaveCourse(userId: string, courseId: string): Promise<boolean> {
  const result = getDb()
    .delete(courseMembers)
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, userId)))
    .run();
  dropSharesBy(userId, courseId);
  return result.changes > 0;
}

/** The course's members, by name; for its owner or one of its members, empty otherwise. */
export async function listCourseMembers(
  viewerId: string,
  courseId: string,
): Promise<CourseMember[]> {
  const rows = getDb()
    .select({ userId: users.id, name: users.name, role: courseMembers.role })
    .from(courseMembers)
    .innerJoin(users, eq(users.id, courseMembers.userId))
    .where(eq(courseMembers.courseId, courseId))
    .orderBy(asc(users.name))
    .all()
    .map((r) => ({ ...r, role: isRole(r.role) ? r.role : "editor" }));
  const mayRead = ownerOf(courseId) === viewerId || rows.some((r) => r.userId === viewerId);
  return mayRead ? rows : [];
}

/** Whether the viewer may share the course and choose its members. */
export async function canManageCourse(userId: string, courseId: string): Promise<boolean> {
  return managesCourse(userId, courseId);
}

/** Who a manager can still add: their team-mates who are not owner or member yet. */
export async function listMemberCandidates(
  callerId: string,
  courseId: string,
): Promise<Colleague[]> {
  if (!managesCourse(callerId, courseId)) return [];
  const taken = new Set(
    getDb()
      .select({ userId: courseMembers.userId })
      .from(courseMembers)
      .where(eq(courseMembers.courseId, courseId))
      .all()
      .map((r) => r.userId),
  );
  taken.add(ownerOf(courseId) ?? "");
  return teammates(callerId).filter((t) => !taken.has(t.userId));
}
