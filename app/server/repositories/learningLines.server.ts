/**
 * Learning lines (leerlijnen): a named, ordered series of a programme's courses. Access follows
 * the programme (`getProgramme`): every team member reads, the lead or an admin manages. The
 * courses are read through `listProgrammeCourses`, so a line only ever shows a course that is
 * still in the programme and still shared with its team.
 */
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { CourseDataSchema } from "~/lib/courses/schema";
import type { LearningOutcome } from "~/lib/courses/types";
import { getDb } from "../db.server";
import { learningLines } from "../schema.server";
import { type Actor, getProgramme, listProgrammeCourses } from "./programmes.server";

export const LINE_LIMITS = { name: 200, courses: 60 } as const;

export interface LearningLine {
  id: string;
  programmeId: string;
  name: string;
  courseIds: string[];
}

type Row = typeof learningLines.$inferSelect;

const rowToLine = (r: Row): LearningLine => ({
  id: r.id,
  programmeId: r.programmeId,
  name: r.name,
  courseIds: JSON.parse(r.courseIdsJson) as string[],
});

const cleanName = (name: string) => {
  const t = name.trim();
  return t.length >= 1 && t.length <= LINE_LIMITS.name ? t : null;
};

/** The ids, if each is a course of the programme the actor sees, once, within the limit. */
function validIds(ids: string[], inProgramme: { courseId: string }[]): string[] | null {
  const known = new Set(inProgramme.map((c) => c.courseId));
  if (ids.length > LINE_LIMITS.courses || new Set(ids).size !== ids.length) return null;
  return ids.every((id) => known.has(id)) ? ids : null;
}

const lineRow = (id: string) =>
  getDb().select().from(learningLines).where(eq(learningLines.id, id)).get();

/** The line and its programme, when the actor may manage that programme. */
async function managed(a: Actor, id: string) {
  const row = lineRow(id);
  const programme = row ? await getProgramme(a, row.programmeId) : null;
  return row && programme?.canManage ? { row, programme } : null;
}

function write(id: string, set: Partial<Pick<Row, "name" | "courseIdsJson">>): void {
  getDb()
    .update(learningLines)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(learningLines.id, id))
    .run();
}

export async function listLines(a: Actor, programmeId: string): Promise<LearningLine[]> {
  if (!(await getProgramme(a, programmeId))) return [];
  return getDb()
    .select()
    .from(learningLines)
    .where(eq(learningLines.programmeId, programmeId))
    .orderBy(asc(learningLines.name))
    .limit(LINE_LIMITS.courses)
    .all()
    .map(rowToLine);
}

export interface LineCourseView {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  outcomes: LearningOutcome[];
}

/** The line with its visible courses in line order and their outcomes, or null. */
export async function getLine(
  a: Actor,
  id: string,
): Promise<
  | (LearningLine & {
      programmeName: string;
      teamName: string;
      canManage: boolean;
      courses: LineCourseView[];
    })
  | null
> {
  const row = lineRow(id);
  const programme = row ? await getProgramme(a, row.programmeId) : null;
  if (!row || !programme) return null;
  const visible = new Map(
    listProgrammeCourses(programme.id, programme.teamId).map((c) => [c.courseId, c]),
  );
  const line = rowToLine(row);
  const courses = line.courseIds.flatMap((courseId) => {
    const c = visible.get(courseId);
    if (!c) return [];
    const data = CourseDataSchema.safeParse(JSON.parse(c.dataJson));
    const outcomes = data.success ? (data.data.outcomes as LearningOutcome[]) : [];
    return [{ id: c.courseId, name: c.name, ownerId: c.ownerId, ownerName: c.ownerName, outcomes }];
  });
  return {
    ...line,
    programmeName: programme.name,
    teamName: programme.teamName,
    canManage: programme.canManage,
    courses,
  };
}

/** Null when the actor may not manage the programme, or the name or courses are invalid. */
export async function createLine(
  a: Actor,
  programmeId: string,
  name: string,
  courseIds: string[],
): Promise<LearningLine | null> {
  const programme = await getProgramme(a, programmeId);
  const clean = cleanName(name);
  const ids = programme ? validIds(courseIds, programme.courses) : null;
  if (!programme?.canManage || !clean || !ids) return null;
  const now = new Date();
  const row: Row = {
    id: randomUUID(),
    programmeId,
    name: clean,
    courseIdsJson: JSON.stringify(ids),
    createdBy: a.id,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(learningLines).values(row).run();
  return rowToLine(row);
}

export async function renameLine(a: Actor, id: string, name: string): Promise<boolean> {
  const hit = await managed(a, id);
  const clean = cleanName(name);
  if (!hit || !clean) return false;
  write(id, { name: clean });
  return true;
}

/** Replaces the courses of the line, in this order. */
export async function setLineCourses(a: Actor, id: string, courseIds: string[]): Promise<boolean> {
  const hit = await managed(a, id);
  const ids = hit ? validIds(courseIds, hit.programme.courses) : null;
  if (!ids) return false;
  write(id, { courseIdsJson: JSON.stringify(ids) });
  return true;
}

/** Moves one course a place up (-1) or down (+1); false at the edge or without the right. */
export async function moveCourse(
  a: Actor,
  id: string,
  courseId: string,
  direction: -1 | 1,
): Promise<boolean> {
  const hit = await managed(a, id);
  if (!hit) return false;
  const ids = rowToLine(hit.row).courseIds;
  const from = ids.indexOf(courseId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return false;
  [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
  write(id, { courseIdsJson: JSON.stringify(ids) });
  return true;
}

export async function deleteLine(a: Actor, id: string): Promise<boolean> {
  if (!(await managed(a, id))) return false;
  getDb().delete(learningLines).where(eq(learningLines.id, id)).run();
  return true;
}
