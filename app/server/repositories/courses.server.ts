/**
 * Courses and their generation links (brief P20, 20.2). Repository rule: async,
 * every query scoped to the owning `userId`, and every write re-parsed with
 * `CourseDataSchema` so the stored graph is always consistent.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { CourseDataSchema, COURSE_LIMITS, emptyCourseData } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { getDb } from "../db.server";
import {
  agentReviews,
  contextProfiles,
  courseLinks,
  courses,
  generations,
  programmeCourses,
  reviewDecisions,
  shares,
} from "../schema.server";

export interface Course {
  id: string;
  name: string;
  contextProfileId: string | null;
  data: CourseData;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseLink = typeof courseLinks.$inferSelect;

const cap = (limit?: number) => Math.min(limit ?? 50, 500);

function parseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > COURSE_LIMITS.title)
    throw new Error("Invalid course name");
  return trimmed;
}

const parseData = (data: CourseData): CourseData => CourseDataSchema.parse(data) as CourseData;

/** A course may only point at the caller's own context profile. */
function assertOwnProfile(userId: string, profileId: string | null): void {
  if (profileId === null) return;
  const own = getDb()
    .select({ id: contextProfiles.id })
    .from(contextProfiles)
    .where(and(eq(contextProfiles.id, profileId), eq(contextProfiles.userId, userId)))
    .get();
  if (!own) throw new Error("Unknown context profile");
}

function rowToCourse(row: typeof courses.$inferSelect): Course {
  return {
    id: row.id,
    name: row.name,
    contextProfileId: row.contextProfileId,
    data: parseData(JSON.parse(row.dataJson)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const ownCourse = (userId: string, id: string) =>
  and(eq(courses.id, id), eq(courses.userId, userId));

export async function listCourses(userId: string, limit?: number): Promise<Course[]> {
  return getDb()
    .select()
    .from(courses)
    .where(eq(courses.userId, userId))
    .orderBy(desc(courses.updatedAt))
    .limit(cap(limit))
    .all()
    .map(rowToCourse);
}

export async function getCourse(userId: string, id: string): Promise<Course | null> {
  const row = getDb().select().from(courses).where(ownCourse(userId, id)).get();
  return row ? rowToCourse(row) : null;
}

export async function createCourse(
  userId: string,
  input: { name: string; contextProfileId?: string | null; data?: CourseData },
): Promise<Course> {
  const data = parseData(input.data ?? emptyCourseData());
  const contextProfileId = input.contextProfileId ?? null;
  assertOwnProfile(userId, contextProfileId);
  const now = new Date();
  const row = {
    id: randomUUID(),
    userId,
    name: parseName(input.name),
    contextProfileId,
    dataJson: JSON.stringify(data),
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(courses).values(row).run();
  return { id: row.id, name: row.name, contextProfileId, data, createdAt: now, updatedAt: now };
}

/**
 * Updates name, context profile and/or data. Returns null when the course is not the
 * caller's; throws on invalid input (nothing is written). A link whose item left the
 * course keeps the course but loses the item.
 */
export async function updateCourse(
  userId: string,
  id: string,
  patch: { name?: string; contextProfileId?: string | null; data?: CourseData },
): Promise<Course | null> {
  const existing = await getCourse(userId, id);
  if (!existing) return null;
  const name = patch.name === undefined ? existing.name : parseName(patch.name);
  const data = patch.data === undefined ? existing.data : parseData(patch.data);
  const contextProfileId =
    patch.contextProfileId === undefined ? existing.contextProfileId : patch.contextProfileId;
  assertOwnProfile(userId, contextProfileId);
  // Strictly later than the previous write, so "newest first" stays stable.
  const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
  const itemIds = new Set([...data.activities, ...data.assessments].map((i) => i.id));
  getDb().transaction((tx) => {
    tx.update(courses)
      .set({ name, contextProfileId, dataJson: JSON.stringify(data), updatedAt })
      .where(ownCourse(userId, id))
      .run();
    const stale = tx
      .select({ id: courseLinks.id, itemId: courseLinks.itemId })
      .from(courseLinks)
      .where(and(eq(courseLinks.courseId, id), eq(courseLinks.userId, userId)))
      .all()
      .filter((l) => l.itemId !== null && !itemIds.has(l.itemId))
      .map((l) => l.id);
    if (stale.length)
      tx.update(courseLinks).set({ itemId: null }).where(inArray(courseLinks.id, stale)).run();
  });
  return { ...existing, name, contextProfileId, data, updatedAt };
}

/** Deletes the course, its links, its reviews and its shares (P28.4) in one transaction. */
export async function deleteCourse(userId: string, id: string): Promise<boolean> {
  return getDb().transaction((tx) => {
    const result = tx.delete(courses).where(ownCourse(userId, id)).run();
    if (result.changes === 0) return false;
    tx.delete(courseLinks)
      .where(and(eq(courseLinks.courseId, id), eq(courseLinks.userId, userId)))
      .run();
    tx.delete(shares)
      .where(and(eq(shares.kind, "course"), eq(shares.itemId, id), eq(shares.ownerUserId, userId)))
      .run();
    tx.delete(programmeCourses)
      .where(and(eq(programmeCourses.courseId, id), eq(programmeCourses.userId, userId)))
      .run();
    // P21.3: the course's role-agent reviews and the decisions on them.
    const reviewIds = tx
      .select({ id: agentReviews.id })
      .from(agentReviews)
      .where(and(eq(agentReviews.courseId, id), eq(agentReviews.userId, userId)))
      .all()
      .map((r) => r.id);
    if (reviewIds.length) {
      tx.delete(reviewDecisions)
        .where(
          and(inArray(reviewDecisions.reviewId, reviewIds), eq(reviewDecisions.userId, userId)),
        )
        .run();
      tx.delete(agentReviews).where(inArray(agentReviews.id, reviewIds)).run();
    }
    return true;
  });
}

/**
 * Links a generation to a course, optionally to one activity or assessment. The caller
 * must own both the course and the generation, and `itemId` must exist in the course;
 * otherwise nothing is written and the result is null. Re-linking upserts.
 */
export async function linkGeneration(
  userId: string,
  courseId: string,
  generationId: string,
  itemId?: string | null,
): Promise<CourseLink | null> {
  const course = await getCourse(userId, courseId);
  if (!course) return null;
  const generation = getDb()
    .select({ id: generations.id })
    .from(generations)
    .where(and(eq(generations.id, generationId), eq(generations.userId, userId)))
    .get();
  if (!generation) return null;
  const item = itemId ?? null;
  if (item !== null) {
    const known = [...course.data.activities, ...course.data.assessments].some(
      (i) => i.id === item,
    );
    if (!known) return null;
  }
  const row: CourseLink = {
    id: randomUUID(),
    userId,
    courseId,
    generationId,
    itemId: item,
    createdAt: new Date(),
  };
  return getDb()
    .insert(courseLinks)
    .values(row)
    .onConflictDoUpdate({
      target: [courseLinks.courseId, courseLinks.generationId],
      set: { itemId: item },
    })
    .returning()
    .get();
}

export async function unlinkGeneration(
  userId: string,
  courseId: string,
  generationId: string,
): Promise<boolean> {
  const result = getDb()
    .delete(courseLinks)
    .where(
      and(
        eq(courseLinks.courseId, courseId),
        eq(courseLinks.generationId, generationId),
        eq(courseLinks.userId, userId),
      ),
    )
    .run();
  return result.changes > 0;
}

export async function listLinksForCourse(
  userId: string,
  courseId: string,
  limit?: number,
): Promise<CourseLink[]> {
  return getDb()
    .select()
    .from(courseLinks)
    .where(and(eq(courseLinks.courseId, courseId), eq(courseLinks.userId, userId)))
    .orderBy(desc(courseLinks.createdAt))
    .limit(cap(limit))
    .all();
}

/** All of the caller's links, for the course badges on "Mijn werk". */
export async function listCourseLinksForUser(
  userId: string,
  limit?: number,
): Promise<CourseLink[]> {
  return getDb()
    .select()
    .from(courseLinks)
    .where(eq(courseLinks.userId, userId))
    .orderBy(desc(courseLinks.createdAt))
    .limit(cap(limit))
    .all();
}

export interface LinkedWork {
  generationId: string;
  toolSlug: string;
  itemId: string | null;
  createdAt: Date;
}

/** The caller's work linked to one course, newest link first (the course page, 20.4). */
export async function listLinkedWork(
  userId: string,
  courseId: string,
  limit?: number,
): Promise<LinkedWork[]> {
  return getDb()
    .select({
      generationId: generations.id,
      toolSlug: generations.toolSlug,
      itemId: courseLinks.itemId,
      createdAt: generations.createdAt,
    })
    .from(courseLinks)
    .innerJoin(
      generations,
      and(eq(generations.id, courseLinks.generationId), eq(generations.userId, userId)),
    )
    .where(and(eq(courseLinks.courseId, courseId), eq(courseLinks.userId, userId)))
    .orderBy(desc(courseLinks.createdAt))
    .limit(cap(limit))
    .all();
}
