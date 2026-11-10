/**
 * Handing a course over (BESLUIT-2026-11-10-5): ownership moves at once to a colleague. The
 * owner hands over to a team-mate; an admin hands over to any active colleague, also when the
 * teacher is disabled. When an account goes, a course with a co-owner goes to the earliest
 * co-owner. Every function is scoped to the course's current owner in the WHERE clause.
 */
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "../db.server";
import { courseMembers, courses, programmeCourses, shares, users } from "../schema.server";
import {
  COURSE_ROLES,
  type Colleague,
  type CourseMember,
  type CourseRole,
  listCourseMembers,
  listTeammates,
} from "./courseMembers.server";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Moves one course from `from` to `to`, in one transaction: the receiver is owner (no longer
 * a member), the context profile stays with its owner, the old owner's shares and programme
 * places go along, and the old owner stays editor or leaves. Linked work and reviews stay with
 * whoever made them.
 */
function move(tx: Tx, courseId: string, from: string, to: string, keepAsEditor: boolean): boolean {
  const moved = tx
    .update(courses)
    .set({ userId: to, contextProfileId: null })
    .where(and(eq(courses.id, courseId), eq(courses.userId, from)))
    .run();
  if (moved.changes === 0) return false;
  tx.delete(courseMembers)
    .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, to)))
    .run();
  if (keepAsEditor) {
    tx.insert(courseMembers)
      .values({ courseId, userId: from, role: "editor", createdAt: new Date() })
      .onConflictDoUpdate({
        target: [courseMembers.courseId, courseMembers.userId],
        set: { role: "editor" },
      })
      .run();
  }
  tx.update(shares)
    .set({ ownerUserId: to })
    .where(
      and(eq(shares.kind, "course"), eq(shares.itemId, courseId), eq(shares.ownerUserId, from)),
    )
    .run();
  tx.update(programmeCourses)
    .set({ userId: to })
    .where(and(eq(programmeCourses.courseId, courseId), eq(programmeCourses.userId, from)))
    .run();
  return true;
}

function ownerOf(courseId: string): string | null {
  return (
    getDb().select({ ownerId: courses.userId }).from(courses).where(eq(courses.id, courseId)).get()
      ?.ownerId ?? null
  );
}

function isActive(userId: string): boolean {
  return !!getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.disabledAt)))
    .get();
}

/** Who the owner can hand the course to: active team-mates and members; empty for others. */
export async function listTransferCandidates(
  callerId: string,
  courseId: string,
): Promise<Colleague[]> {
  if (ownerOf(courseId) !== callerId) return [];
  const byId = new Map((await listTeammates(callerId)).map((c) => [c.userId, c]));
  for (const m of await listCourseMembers(callerId, courseId)) {
    if (!byId.has(m.userId) && isActive(m.userId))
      byId.set(m.userId, { userId: m.userId, name: m.name });
  }
  return [...byId.values()].sort((x, y) => x.name.localeCompare(y.name));
}

/** The owner hands the course to a candidate. False (nothing written) otherwise. */
export async function transferCourse(
  callerId: string,
  courseId: string,
  toId: string,
  keepAsEditor: boolean,
): Promise<boolean> {
  const candidates = await listTransferCandidates(callerId, courseId);
  if (!candidates.some((c) => c.userId === toId)) return false;
  return getDb().transaction((tx) => move(tx, courseId, callerId, toId, keepAsEditor));
}

/** An admin hands one course of `ownerId` to any active colleague. */
export async function adminTransferCourse(
  ownerId: string,
  courseId: string,
  toId: string,
  keepAsEditor: boolean,
): Promise<boolean> {
  if (toId === ownerId || !isActive(toId)) return false;
  return getDb().transaction((tx) => move(tx, courseId, ownerId, toId, keepAsEditor));
}

/** An admin hands every course of `ownerId` to one colleague; how many moved. */
export async function adminTransferAll(
  ownerId: string,
  toId: string,
  keepAsEditor: boolean,
): Promise<number> {
  if (toId === ownerId || !isActive(toId)) return 0;
  return getDb().transaction((tx) => {
    const ids = tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.userId, ownerId))
      .all();
    return ids.filter((c) => move(tx, c.id, ownerId, toId, keepAsEditor)).length;
  });
}

export interface OwnedCourse {
  id: string;
  name: string;
  members: CourseMember[];
}

/** The courses `ownerId` owns, by name, with their members (for the admin's page). */
export async function listOwnedCourses(ownerId: string): Promise<OwnedCourse[]> {
  const rows = getDb()
    .select({ id: courses.id, name: courses.name })
    .from(courses)
    .where(eq(courses.userId, ownerId))
    .orderBy(asc(courses.name))
    .limit(500)
    .all();
  return Promise.all(
    rows.map(async (c) => ({ ...c, members: await listCourseMembers(ownerId, c.id) })),
  );
}

/** An admin makes any active colleague a member of a course of `ownerId`. */
export async function adminSetCourseMember(
  ownerId: string,
  courseId: string,
  userId: string,
  role: CourseRole,
): Promise<boolean> {
  if (!(COURSE_ROLES as readonly string[]).includes(role)) return false;
  if (userId === ownerId || ownerOf(courseId) !== ownerId || !isActive(userId)) return false;
  getDb().transaction((tx) => {
    tx.insert(courseMembers)
      .values({ courseId, userId, role, createdAt: new Date() })
      .onConflictDoUpdate({ target: [courseMembers.courseId, courseMembers.userId], set: { role } })
      .run();
    if (role !== "co-owner") dropSharesBy(tx, userId, courseId);
  });
  return true;
}

/** An admin takes a member off a course of `ownerId`. */
export async function adminRemoveCourseMember(
  ownerId: string,
  courseId: string,
  userId: string,
): Promise<boolean> {
  if (ownerOf(courseId) !== ownerId) return false;
  return getDb().transaction((tx) => {
    const result = tx
      .delete(courseMembers)
      .where(and(eq(courseMembers.courseId, courseId), eq(courseMembers.userId, userId)))
      .run();
    dropSharesBy(tx, userId, courseId);
    return result.changes > 0;
  });
}

function dropSharesBy(tx: Tx, userId: string, courseId: string): void {
  tx.delete(shares)
    .where(
      and(eq(shares.kind, "course"), eq(shares.itemId, courseId), eq(shares.ownerUserId, userId)),
    )
    .run();
}

/** Each course of `userId` with a co-owner, and its earliest active co-owner. */
function successors(userId: string): { courseId: string; to: string }[] {
  const rows = getDb()
    .select({ courseId: courseMembers.courseId, to: courseMembers.userId })
    .from(courseMembers)
    .innerJoin(courses, eq(courses.id, courseMembers.courseId))
    .innerJoin(users, eq(users.id, courseMembers.userId))
    .where(
      and(
        eq(courses.userId, userId),
        eq(courseMembers.role, "co-owner"),
        ne(courseMembers.userId, userId),
        isNull(users.disabledAt),
      ),
    )
    .orderBy(asc(courseMembers.createdAt), asc(courseMembers.userId))
    .all();
  const first = new Map<string, string>();
  for (const r of rows) if (!first.has(r.courseId)) first.set(r.courseId, r.to);
  return [...first].map(([courseId, to]) => ({ courseId, to }));
}

/** How many of `userId`'s courses would go with the account: those without a co-owner. */
export async function countCoursesWithoutSuccessor(userId: string): Promise<number> {
  const owned = getDb()
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.userId, userId))
    .all().length;
  return owned - successors(userId).length;
}

/** Before an account goes: each course with a co-owner goes to the earliest co-owner. */
export async function handOverToCoOwners(userId: string): Promise<number> {
  const next = successors(userId);
  return getDb().transaction(
    (tx) => next.filter((s) => move(tx, s.courseId, userId, s.to, false)).length,
  );
}
