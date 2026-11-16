/**
 * Programmes (opleidingen) of one or more teams (BESLUIT-2026-11-10-3, BESLUIT-2026-11-16-1) and
 * the courses in them. Repository rule for team-owned rows: every query is scoped in its WHERE
 * clause to the teams the actor is in (an admin: every team). Managing (create, rename, delete)
 * is for a lead of one of its teams or an admin; linking teams is in `programmeTeams.server.ts`.
 * Placing a course is for its owner, in a programme of a team they are in, and shares the course
 * with the programme's teams they are in; colleagues read it only through that share
 * (`listProgrammeCourses`, the one read of another teacher's row outside `shares.server.ts`;
 * the learning lines read their courses through it too).
 * Stopping the share, leaving the team or deleting the course takes it out of the programme:
 * every read joins the share, and the team's own clean-up removes the rows.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, or, type SQL, sql } from "drizzle-orm";
import {
  type Placement,
  PlacementSchema,
  type ProgrammeForm,
  ProgrammeInputSchema,
} from "~/lib/programmes/schema";
import type { Sector } from "~/lib/context/sectors";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { getDb } from "../db.server";
import {
  courseMembers,
  courses,
  learningLineProgrammes,
  learningLines,
  programmeCourses,
  programmeTeams,
  programmes,
  shares,
  teamMembers,
  teams,
  users,
} from "../schema.server";
import { myTeams, namesOf, teamsOf } from "./programmeTeams.server";
import { shareItem } from "./shares.server";

/** Who acts: the signed-in user's id and role. */
export interface Actor {
  id: string;
  role: string;
}

export interface Programme {
  id: string;
  /** Its teams (at least one), by name. */
  teamIds: string[];
  name: string;
  sector: Sector;
  track: string | null;
  form: ProgrammeForm | null;
  /** The division it sits under (faculty, location, …), or null. Set on Beheer → Organisatie. */
  divisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgrammeCourse {
  courseId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  year: number | null;
  period: number | null;
}

const cap = (limit?: number) => Math.min(limit ?? 50, 500);

/**
 * The course is shared with one of the programme's teams by someone who may share it (its owner
 * or a co-owner, BESLUIT-2026-11-10-5) and who is still in that team. Needs `courses` in the query.
 */
const sharedWithProgramme = (programmeId: SQL | SQLiteColumn | string) =>
  sql`exists (select 1 from ${shares} s
    join ${programmeTeams} pt on pt.team_id = s.team_id and pt.programme_id = ${programmeId}
    join ${teamMembers} sharer on sharer.team_id = s.team_id and sharer.user_id = s.owner_user_id
    where s.kind = 'course' and s.item_id = ${courses.id}
      and (s.owner_user_id = ${courses.userId} or exists (select 1 from ${courseMembers} cm
        where cm.course_id = ${courses.id} and cm.user_id = s.owner_user_id
          and cm.role = 'co-owner')))`;

/**
 * The courses in a programme, by year, period and name (unplaced last): only those shared with
 * one of its teams by their owner or a co-owner who is still in it, with the course JSON (for
 * the learning line overview). Callers check first that the viewer may read the programme.
 */
export function listProgrammeCourses(
  programmeId: string,
): (ProgrammeCourse & { dataJson: string })[] {
  return getDb()
    .select({
      dataJson: courses.dataJson,
      courseId: courses.id,
      name: courses.name,
      ownerId: courses.userId,
      ownerName: users.name,
      year: programmeCourses.year,
      period: programmeCourses.period,
    })
    .from(programmeCourses)
    .innerJoin(courses, eq(courses.id, programmeCourses.courseId))
    .innerJoin(users, eq(users.id, courses.userId))
    .where(and(eq(programmeCourses.programmeId, programmeId), sharedWithProgramme(programmeId)))
    .orderBy(
      sql`${programmeCourses.year} IS NULL`,
      asc(programmeCourses.year),
      sql`${programmeCourses.period} IS NULL`,
      asc(programmeCourses.period),
      asc(courses.name),
    )
    .limit(cap(500))
    .all();
}
const isAdmin = (a: Actor) => a.role === "admin";

type Row = typeof programmes.$inferSelect;

const rowToProgramme = (r: Row, teamIds: string[]): Programme => ({
  id: r.id,
  teamIds,
  name: r.name,
  sector: r.sector as Sector,
  track: r.track,
  form: r.form as ProgrammeForm | null,
  divisionId: r.divisionId,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** An admin, or a lead of one of the programme's teams. */
const canManage = (a: Actor, programmeId: string) =>
  isAdmin(a) || myTeams(a.id, programmeId).some((m) => m.isLead);

/** Programmes the actor may read: of a team they are in, or any for an admin. */
const readable = (a: Actor): SQL | undefined =>
  isAdmin(a)
    ? undefined
    : sql`exists (select 1 from ${programmeTeams} pt join ${teamMembers} m
        on m.team_id = pt.team_id where pt.programme_id = ${programmes.id} and m.user_id = ${a.id})`;

/** A programme row with its teams, as the actor sees it. */
function withTeams(a: Actor, p: Row, list: { id: string; name: string }[] = []) {
  const ids = list.map((t) => t.id);
  return {
    ...rowToProgramme(p, ids),
    teams: list,
    teamName: namesOf(list),
    canManage: canManage(a, p.id),
  };
}

function parseInput(input: unknown) {
  const p = ProgrammeInputSchema.parse(input);
  return { name: p.name, sector: p.sector, track: p.track ?? null, form: p.form ?? null };
}

/** The teams the actor may create a programme for: where they lead; every team for an admin. */
export async function manageableTeams(a: Actor): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  if (isAdmin(a))
    return db.select({ id: teams.id, name: teams.name }).from(teams).orderBy(asc(teams.name)).all();
  return db
    .select({ id: teams.id, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, a.id), eq(teamMembers.isLead, true)))
    .orderBy(asc(teams.name))
    .all();
}

export async function listProgrammes(
  a: Actor,
  limit?: number,
): Promise<(ReturnType<typeof withTeams> & { courseCount: number })[]> {
  const rows = getDb()
    .select()
    .from(programmes)
    .where(readable(a))
    .orderBy(asc(programmes.name))
    .limit(cap(limit))
    .all();
  const byProgramme = teamsOf(rows.map((p) => p.id));
  return rows.map((p) => ({
    ...withTeams(a, p, byProgramme.get(p.id)),
    courseCount: listProgrammeCourses(p.id).length,
  }));
}

/** The programme with its courses (year, period, name; unplaced last), or null. */
export async function getProgramme(
  a: Actor,
  id: string,
): Promise<(ReturnType<typeof withTeams> & { courses: ProgrammeCourse[] }) | null> {
  const p = getDb()
    .select()
    .from(programmes)
    .where(and(eq(programmes.id, id), readable(a)))
    .get();
  if (!p) return null;
  return {
    ...withTeams(a, p, teamsOf([p.id]).get(p.id)),
    courses: listProgrammeCourses(p.id).map(({ dataJson: _, ...c }) => c),
  };
}

/** Null when the actor may not manage the team; throws on invalid input (nothing written). */
export async function createProgramme(
  a: Actor,
  teamId: string,
  input: unknown,
): Promise<Programme | null> {
  const values = parseInput(input);
  if (!(await manageableTeams(a)).some((t) => t.id === teamId)) return null;
  const now = new Date();
  const row: Row = {
    id: randomUUID(),
    createdBy: a.id,
    ...values,
    divisionId: null,
    createdAt: now,
    updatedAt: now,
  };
  getDb().transaction((tx) => {
    tx.insert(programmes).values(row).run();
    tx.insert(programmeTeams).values({ programmeId: row.id, teamId, createdAt: now }).run();
  });
  return rowToProgramme(row, [teamId]);
}

function managedRow(a: Actor, id: string): Row | undefined {
  const row = getDb()
    .select()
    .from(programmes)
    .where(and(eq(programmes.id, id), readable(a)))
    .get();
  return row && canManage(a, row.id) ? row : undefined;
}

/** Null when the actor may not manage it; throws on invalid input. */
export async function updateProgramme(
  a: Actor,
  id: string,
  input: unknown,
): Promise<Programme | null> {
  const values = parseInput(input);
  const row = managedRow(a, id);
  if (!row) return null;
  const updated = getDb()
    .update(programmes)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(programmes.id, row.id))
    .returning()
    .get();
  const ids = (teamsOf([id]).get(id) ?? []).map((t) => t.id);
  return updated ? rowToProgramme(updated, ids) : null;
}

/** Removes the programme and its placements; the courses and their shares stay. */
export async function deleteProgramme(a: Actor, id: string): Promise<boolean> {
  const row = managedRow(a, id);
  if (!row) return false;
  getDb().transaction((tx) => {
    tx.delete(programmeCourses).where(eq(programmeCourses.programmeId, row.id)).run();
    // Its own lines go with their links; a line of another programme only loses this link.
    tx.run(sql`delete from ${learningLineProgrammes} where programme_id = ${row.id}
      or line_id in (select id from ${learningLines} where programme_id = ${row.id})`);
    tx.delete(learningLines).where(eq(learningLines.programmeId, row.id)).run();
    tx.delete(programmeTeams).where(eq(programmeTeams.programmeId, row.id)).run();
    tx.delete(programmes).where(eq(programmes.id, row.id)).run();
  });
  return true;
}

/**
 * Puts a course the actor owns or co-owns in a programme of a team they are in, at this year
 * and period (or moves it there), and shares the course with the programme's teams they are in.
 * False otherwise.
 */
export async function placeCourse(
  a: Actor,
  programmeId: string,
  courseId: string,
  placement: Placement,
): Promise<boolean> {
  const parsed = PlacementSchema.safeParse(placement);
  if (!parsed.success) return false;
  const db = getDb();
  const mine = myTeams(a.id, programmeId);
  if (mine.length === 0) return false;
  for (const { teamId } of mine)
    if (!(await shareItem(a.id, "course", courseId, teamId))) return false;
  const year = parsed.data.year ?? null;
  const period = parsed.data.period ?? null;
  db.insert(programmeCourses)
    .values({
      id: randomUUID(),
      userId: a.id,
      programmeId,
      courseId,
      year,
      period,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [programmeCourses.programmeId, programmeCourses.courseId],
      set: { year, period },
    })
    .run();
  return true;
}

/**
 * Takes a course out: whoever placed it, its owner or a co-owner, or whoever manages the
 * programme. The share stays.
 */
export async function removeCourse(
  a: Actor,
  programmeId: string,
  courseId: string,
): Promise<boolean> {
  const programme = getDb()
    .select({ id: programmes.id })
    .from(programmes)
    .where(eq(programmes.id, programmeId))
    .get();
  if (!programme) return false;
  const who = canManage(a, programme.id)
    ? undefined
    : or(
        eq(programmeCourses.userId, a.id),
        sql`exists (select 1 from ${courses} c where c.id = ${programmeCourses.courseId}
          and (c.user_id = ${a.id} or exists (select 1 from ${courseMembers} cm
            where cm.course_id = c.id and cm.user_id = ${a.id} and cm.role = 'co-owner')))`,
      );
  const result = getDb()
    .delete(programmeCourses)
    .where(
      and(
        eq(programmeCourses.programmeId, programmeId),
        eq(programmeCourses.courseId, courseId),
        who,
      ),
    )
    .run();
  return result.changes > 0;
}

/**
 * Where a course sits: the programmes it is placed in while a share stands. Callers check
 * first that the viewer may open the course (owner or member, BESLUIT-2026-11-10-5).
 */
export async function programmesOfCourse(courseId: string): Promise<
  {
    programmeId: string;
    name: string;
    teamName: string;
    year: number | null;
    period: number | null;
  }[]
> {
  const rows = getDb()
    .select({
      programmeId: programmes.id,
      name: programmes.name,
      year: programmeCourses.year,
      period: programmeCourses.period,
    })
    .from(programmeCourses)
    .innerJoin(programmes, eq(programmes.id, programmeCourses.programmeId))
    .innerJoin(courses, eq(courses.id, programmeCourses.courseId))
    .where(and(eq(programmeCourses.courseId, courseId), sharedWithProgramme(programmes.id)))
    .orderBy(asc(programmes.name))
    .limit(cap(500))
    .all();
  const byProgramme = teamsOf(rows.map((r) => r.programmeId));
  return rows.map((r) => ({ ...r, teamName: namesOf(byProgramme.get(r.programmeId)) }));
}

/** The programmes a teacher may put a course in: those of every team they are in. */
export async function placeOptions(
  userId: string,
): Promise<{ id: string; name: string; teamName: string }[]> {
  const rows = getDb()
    .select({ id: programmes.id, name: programmes.name })
    .from(programmes)
    .where(readable({ id: userId, role: "teacher" }))
    .orderBy(asc(programmes.name))
    .limit(cap(500))
    .all();
  const byProgramme = teamsOf(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, teamName: namesOf(byProgramme.get(r.id)) }));
}
