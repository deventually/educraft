/**
 * Learning lines (leerlijnen): a named, ordered series of courses. A line has its own programme
 * and may also hold for other programmes (`learning_line_programmes`, BESLUIT-2026-11-12-2).
 * Access follows the programmes (`getProgramme`): a member of any linked programme's team reads
 * it; the lead of its own programme or an admin manages it, and linking another programme takes
 * managing that one too. The courses are read through `listProgrammeCourses` of the programmes
 * the reader may read, so a line only shows a course that is still in one of them and still
 * shared with that team.
 */
import { randomUUID } from "node:crypto";
import { asc, eq, like, or, sql } from "drizzle-orm";
import { CourseDataSchema } from "~/lib/courses/schema";
import type { LearningOutcome } from "~/lib/courses/types";
import { getDb } from "../db.server";
import { learningLineProgrammes, learningLines } from "../schema.server";
import { type Actor, getProgramme, listProgrammeCourses } from "./programmes.server";

export const LINE_LIMITS = { name: 200, courses: 60, programmes: 20 } as const;

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

/** The line's own programme first, then the programmes it also holds for, in link order. */
function linkedIds(row: Row): string[] {
  const extra = getDb()
    .select({ id: learningLineProgrammes.programmeId })
    .from(learningLineProgrammes)
    .where(eq(learningLineProgrammes.lineId, row.id))
    .orderBy(asc(learningLineProgrammes.createdAt))
    .all()
    .map((r) => r.id);
  return [row.programmeId, ...extra.filter((id) => id !== row.programmeId)];
}

/** The linked programmes the actor may read, with their courses as the actor sees them. */
async function readableProgrammes(a: Actor, row: Row) {
  const found = await Promise.all(linkedIds(row).map((id) => getProgramme(a, id)));
  return found.filter((p) => p !== null);
}

/** Every course the actor sees in these programmes, once, by id. */
function visibleCourses(readable: { id: string; teamId: string }[]) {
  const all = new Map<string, ReturnType<typeof listProgrammeCourses>[number]>();
  for (const p of readable)
    for (const c of listProgrammeCourses(p.id, p.teamId))
      if (!all.has(c.courseId)) all.set(c.courseId, c);
  return all;
}

/** The line and the programmes the actor reads, when the actor manages its own programme. */
async function managed(a: Actor, id: string) {
  const row = lineRow(id);
  const readable = row ? await readableProgrammes(a, row) : [];
  const own = readable.find((p) => p.id === row?.programmeId);
  return row && own?.canManage ? { row, readable } : null;
}

function write(id: string, set: Partial<Pick<Row, "name" | "courseIdsJson">>): void {
  getDb()
    .update(learningLines)
    .set({ ...set, updatedAt: new Date() })
    .where(eq(learningLines.id, id))
    .run();
}

/** The lines of this programme: its own, and those of other programmes that also hold for it. */
export async function listLines(a: Actor, programmeId: string): Promise<LearningLine[]> {
  if (!(await getProgramme(a, programmeId))) return [];
  return getDb()
    .select()
    .from(learningLines)
    .where(
      or(
        eq(learningLines.programmeId, programmeId),
        sql`exists (select 1 from ${learningLineProgrammes} lp
          where lp.line_id = ${learningLines.id} and lp.programme_id = ${programmeId})`,
      ),
    )
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

/**
 * The line with the courses the actor sees in line order (from every linked programme the actor
 * reads) and their outcomes, or null when the actor reads none of its programmes.
 */
export async function getLine(
  a: Actor,
  id: string,
): Promise<
  | (LearningLine & {
      programmeName: string;
      teamName: string;
      canManage: boolean;
      programmes: { id: string; name: string }[];
      courses: LineCourseView[];
    })
  | null
> {
  const row = lineRow(id);
  const readable = row ? await readableProgrammes(a, row) : [];
  if (!row || readable.length === 0) return null;
  const own = readable.find((p) => p.id === row.programmeId);
  const visible = visibleCourses(readable);
  const line = rowToLine(row);
  const courses = line.courseIds.flatMap((courseId) => {
    const c = visible.get(courseId);
    if (!c) return [];
    const data = CourseDataSchema.safeParse(JSON.parse(c.dataJson));
    const outcomes = data.success ? (data.data.outcomes as LearningOutcome[]) : [];
    return [{ id: c.courseId, name: c.name, ownerId: c.ownerId, ownerName: c.ownerName, outcomes }];
  });
  const home = own ?? readable[0];
  return {
    ...line,
    programmeName: home?.name ?? "",
    teamName: home?.teamName ?? "",
    canManage: own?.canManage === true,
    programmes: readable.map((p) => ({ id: p.id, name: p.name })),
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

/** Replaces the courses of the line, in this order: each from one of its programmes. */
export async function setLineCourses(a: Actor, id: string, courseIds: string[]): Promise<boolean> {
  const hit = await managed(a, id);
  const ids = hit
    ? validIds(
        courseIds,
        [...visibleCourses(hit.readable).keys()].map((courseId) => ({ courseId })),
      )
    : null;
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
  getDb().transaction((tx) => {
    tx.delete(learningLineProgrammes).where(eq(learningLineProgrammes.lineId, id)).run();
    tx.delete(learningLines).where(eq(learningLines.id, id)).run();
  });
  return true;
}

/**
 * Sets the other programmes the line also holds for (its own programme and duplicates are
 * ignored). False unless the actor manages the line's programme and every programme listed.
 */
export async function setLineProgrammes(
  a: Actor,
  id: string,
  programmeIds: string[],
): Promise<boolean> {
  const hit = await managed(a, id);
  if (!hit) return false;
  const extra = [...new Set(programmeIds)].filter((p) => p !== hit.row.programmeId);
  if (extra.length > LINE_LIMITS.programmes) return false;
  const targets = await Promise.all(extra.map((p) => getProgramme(a, p)));
  if (targets.some((p) => !p?.canManage)) return false;
  const now = Date.now();
  getDb().transaction((tx) => {
    tx.delete(learningLineProgrammes).where(eq(learningLineProgrammes.lineId, id)).run();
    extra.forEach((programmeId, i) => {
      tx.insert(learningLineProgrammes)
        .values({ lineId: id, programmeId, createdAt: new Date(now + i) })
        .run();
    });
  });
  return true;
}

export interface CourseInLine {
  lineId: string;
  name: string;
  /** A programme of the line the viewer reads (its own when they can), for the address. */
  programmeId: string;
  position: number;
  total: number;
  previous?: { id: string; name: string };
  next?: { id: string; name: string };
}

/**
 * Where a course sits in the learning lines the viewer may read: its place among the courses
 * the viewer sees, with the one before and after. Callers check first that the viewer may open
 * the course.
 */
export async function linesOfCourse(a: Actor, courseId: string): Promise<CourseInLine[]> {
  const rows = getDb()
    .select()
    .from(learningLines)
    .where(like(learningLines.courseIdsJson, `%${JSON.stringify(courseId)}%`))
    .orderBy(asc(learningLines.name))
    .limit(LINE_LIMITS.courses)
    .all();
  const found = await Promise.all(rows.map((r) => getLine(a, r.id)));
  return found.flatMap((line) => {
    const at = line ? line.courses.findIndex((c) => c.id === courseId) : -1;
    if (!line || at < 0) return [];
    const pick = (c?: { id: string; name: string }) => (c ? { id: c.id, name: c.name } : undefined);
    const previous = pick(line.courses[at - 1]);
    const next = pick(line.courses[at + 1]);
    return [
      {
        lineId: line.id,
        name: line.name,
        programmeId: line.programmes.some((p) => p.id === line.programmeId)
          ? line.programmeId
          : (line.programmes[0]?.id ?? line.programmeId),
        position: at + 1,
        total: line.courses.length,
        ...(previous ? { previous } : {}),
        ...(next ? { next } : {}),
      },
    ];
  });
}
