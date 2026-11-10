/**
 * Programmes (opleidingen) of a team (BESLUIT-2026-11-10-3) and the courses in them.
 * Repository rule for team-owned rows: every query is scoped in its WHERE clause to the
 * teams the actor is in (an admin: every team). Managing (create, rename, delete) is for the
 * team's lead or an admin. Placing a course is for its owner, in a team they are in, and
 * shares the course with that team; colleagues read it only through that share
 * (`listProgrammeCourses`, the one read of another teacher's row outside `shares.server.ts`;
 * the learning lines read their courses through it too).
 * Stopping the share, leaving the team or deleting the course takes it out of the programme:
 * every read joins the share, and the team's own clean-up removes the rows.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, type SQL, sql } from "drizzle-orm";
import {
  type Placement,
  PlacementSchema,
  type ProgrammeForm,
  ProgrammeInputSchema,
} from "~/lib/programmes/schema";
import type { Sector } from "~/lib/context/sectors";
import { getDb } from "../db.server";
import {
  courses,
  learningLines,
  programmeCourses,
  programmes,
  shares,
  teamMembers,
  teams,
  users,
} from "../schema.server";
import { shareItem } from "./shares.server";

/** Who acts: the signed-in user's id and role. */
export interface Actor {
  id: string;
  role: string;
}

export interface Programme {
  id: string;
  teamId: string;
  name: string;
  sector: Sector;
  track: string | null;
  form: ProgrammeForm | null;
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
 * The courses in a programme of `teamId`, by year, period and name (unplaced last): only those
 * whose owner shares them with that team and is still in it, with the course JSON (for the
 * learning line overview). Callers check first that the viewer may read the programme.
 */
export function listProgrammeCourses(
  programmeId: string,
  teamId: string,
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
    .innerJoin(
      courses,
      and(eq(courses.id, programmeCourses.courseId), eq(courses.userId, programmeCourses.userId)),
    )
    .innerJoin(users, eq(users.id, courses.userId))
    .innerJoin(
      shares,
      and(
        eq(shares.kind, "course"),
        eq(shares.itemId, courses.id),
        eq(shares.ownerUserId, courses.userId),
        eq(shares.teamId, teamId),
      ),
    )
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, courses.userId)),
    )
    .where(eq(programmeCourses.programmeId, programmeId))
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

const rowToProgramme = (r: Row): Programme => ({
  id: r.id,
  teamId: r.teamId,
  name: r.name,
  sector: r.sector as Sector,
  track: r.track,
  form: r.form as ProgrammeForm | null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/** The actor's membership of a team (with the lead stand), or undefined. */
function membership(userId: string, teamId: string) {
  return getDb()
    .select({ isLead: teamMembers.isLead })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .get();
}

const canManageTeam = (a: Actor, teamId: string) =>
  isAdmin(a) || membership(a.id, teamId)?.isLead === true;

/** Programmes the actor may read: of a team they are in, or any for an admin. */
const readable = (a: Actor): SQL | undefined =>
  isAdmin(a)
    ? undefined
    : sql`exists (select 1 from ${teamMembers} m
        where m.team_id = ${programmes.teamId} and m.user_id = ${a.id})`;

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
): Promise<(Programme & { teamName: string; canManage: boolean; courseCount: number })[]> {
  const rows = getDb()
    .select({ p: programmes, teamName: teams.name })
    .from(programmes)
    .innerJoin(teams, eq(teams.id, programmes.teamId))
    .where(readable(a))
    .orderBy(asc(programmes.name), asc(teams.name))
    .limit(cap(limit))
    .all();
  return rows.map(({ p, teamName }) => ({
    ...rowToProgramme(p),
    teamName,
    canManage: canManageTeam(a, p.teamId),
    courseCount: listProgrammeCourses(p.id, p.teamId).length,
  }));
}

/** The programme with its courses (year, period, name; unplaced last), or null. */
export async function getProgramme(
  a: Actor,
  id: string,
): Promise<
  (Programme & { teamName: string; canManage: boolean; courses: ProgrammeCourse[] }) | null
> {
  const hit = getDb()
    .select({ p: programmes, teamName: teams.name })
    .from(programmes)
    .innerJoin(teams, eq(teams.id, programmes.teamId))
    .where(and(eq(programmes.id, id), readable(a)))
    .get();
  if (!hit) return null;
  return {
    ...rowToProgramme(hit.p),
    teamName: hit.teamName,
    canManage: canManageTeam(a, hit.p.teamId),
    courses: listProgrammeCourses(hit.p.id, hit.p.teamId).map(({ dataJson: _, ...c }) => c),
  };
}

/** Null when the actor may not manage the team; throws on invalid input (nothing written). */
export async function createProgramme(
  a: Actor,
  teamId: string,
  input: unknown,
): Promise<Programme | null> {
  const values = parseInput(input);
  const team = getDb().select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).get();
  if (!team || !canManageTeam(a, teamId)) return null;
  const now = new Date();
  const row: Row = {
    id: randomUUID(),
    teamId,
    createdBy: a.id,
    ...values,
    createdAt: now,
    updatedAt: now,
  };
  getDb().insert(programmes).values(row).run();
  return rowToProgramme(row);
}

function managedRow(a: Actor, id: string): Row | undefined {
  const row = getDb()
    .select()
    .from(programmes)
    .where(and(eq(programmes.id, id), readable(a)))
    .get();
  return row && canManageTeam(a, row.teamId) ? row : undefined;
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
  return updated ? rowToProgramme(updated) : null;
}

/** Removes the programme and its placements; the courses and their shares stay. */
export async function deleteProgramme(a: Actor, id: string): Promise<boolean> {
  const row = managedRow(a, id);
  if (!row) return false;
  getDb().transaction((tx) => {
    tx.delete(programmeCourses).where(eq(programmeCourses.programmeId, row.id)).run();
    tx.delete(learningLines).where(eq(learningLines.programmeId, row.id)).run();
    tx.delete(programmes).where(eq(programmes.id, row.id)).run();
  });
  return true;
}

/**
 * Puts the actor's own course in a programme of a team they are in, at this year and period
 * (or moves it there), and shares the course with that team. False otherwise.
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
  const programme = db
    .select({ id: programmes.id, teamId: programmes.teamId })
    .from(programmes)
    .where(eq(programmes.id, programmeId))
    .get();
  if (!programme || !membership(a.id, programme.teamId)) return false;
  if (!(await shareItem(a.id, "course", courseId, programme.teamId))) return false;
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

/** Takes a course out: its owner, or whoever manages the programme. The share stays. */
export async function removeCourse(
  a: Actor,
  programmeId: string,
  courseId: string,
): Promise<boolean> {
  const programme = getDb()
    .select({ teamId: programmes.teamId })
    .from(programmes)
    .where(eq(programmes.id, programmeId))
    .get();
  if (!programme) return false;
  const who = canManageTeam(a, programme.teamId) ? undefined : eq(programmeCourses.userId, a.id);
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

/** Where the owner's course sits: the programmes it is placed in while the share stands. */
export async function programmesOfCourse(
  userId: string,
  courseId: string,
): Promise<
  {
    programmeId: string;
    name: string;
    teamName: string;
    year: number | null;
    period: number | null;
  }[]
> {
  return getDb()
    .select({
      programmeId: programmes.id,
      name: programmes.name,
      teamName: teams.name,
      year: programmeCourses.year,
      period: programmeCourses.period,
    })
    .from(programmeCourses)
    .innerJoin(programmes, eq(programmes.id, programmeCourses.programmeId))
    .innerJoin(teams, eq(teams.id, programmes.teamId))
    .innerJoin(
      shares,
      and(
        eq(shares.kind, "course"),
        eq(shares.itemId, programmeCourses.courseId),
        eq(shares.ownerUserId, userId),
        eq(shares.teamId, programmes.teamId),
      ),
    )
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, programmes.teamId), eq(teamMembers.userId, userId)),
    )
    .innerJoin(courses, and(eq(courses.id, programmeCourses.courseId), eq(courses.userId, userId)))
    .where(and(eq(programmeCourses.courseId, courseId), eq(programmeCourses.userId, userId)))
    .orderBy(asc(programmes.name))
    .limit(cap(500))
    .all();
}

/** The programmes a teacher may put a course in: those of every team they are in. */
export async function placeOptions(
  userId: string,
): Promise<{ id: string; name: string; teamName: string }[]> {
  return getDb()
    .select({ id: programmes.id, name: programmes.name, teamName: teams.name })
    .from(programmes)
    .innerJoin(teams, eq(teams.id, programmes.teamId))
    .innerJoin(
      teamMembers,
      and(eq(teamMembers.teamId, programmes.teamId), eq(teamMembers.userId, userId)),
    )
    .orderBy(asc(programmes.name), asc(teams.name))
    .limit(cap(500))
    .all();
}
