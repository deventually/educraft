/**
 * A module team on a course (BESLUIT-2026-11-16-2). The owner or a co-owner links one of
 * their own teams to the course as editors or co-owners; every member of that team then works
 * on it, for as long as they are in the team (`courseRoles`). The course stays its owner's:
 * deleting, the context profile and handing over stay with the owner. Unlinking ends it.
 */
import { and, asc, eq, inArray, ne, notInArray } from "drizzle-orm";
import { getDb } from "../db.server";
import { courses, courseTeams, teamMembers, teams, users } from "../schema.server";
import { COURSE_ROLES, type CourseRole, managesCourse, worksOn } from "./courseMembers.server";

export interface CourseTeam {
  id: string;
  name: string;
  role: CourseRole;
  /** The names of the team's members, the owner left out. */
  members: string[];
}

const isRole = (role: string): role is CourseRole =>
  (COURSE_ROLES as readonly string[]).includes(role);

const myTeamIds = (userId: string) =>
  getDb()
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));

/**
 * A manager links a team they are in, or changes its role. False (nothing written) when the
 * caller does not manage the course, is not in the team, or the role is unknown.
 */
export async function linkCourseTeam(
  callerId: string,
  courseId: string,
  teamId: string,
  role: CourseRole,
): Promise<boolean> {
  if (!isRole(role) || !managesCourse(callerId, courseId)) return false;
  const inTeam = getDb()
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)))
    .get();
  if (!inTeam) return false;
  getDb()
    .insert(courseTeams)
    .values({ courseId, teamId, role, createdAt: new Date() })
    .onConflictDoUpdate({ target: [courseTeams.courseId, courseTeams.teamId], set: { role } })
    .run();
  return true;
}

/** A manager unlinks a team: its members stop working on the course (unless added by hand). */
export async function unlinkCourseTeam(
  callerId: string,
  courseId: string,
  teamId: string,
): Promise<boolean> {
  if (!managesCourse(callerId, courseId)) return false;
  const result = getDb()
    .delete(courseTeams)
    .where(and(eq(courseTeams.courseId, courseId), eq(courseTeams.teamId, teamId)))
    .run();
  return result.changes > 0;
}

/** The teams linked to the course, by name, with their members; for whoever works on it. */
export async function listCourseTeams(viewerId: string, courseId: string): Promise<CourseTeam[]> {
  if (!worksOn(viewerId, courseId)) return [];
  const db = getDb();
  const linked = db
    .select({ id: teams.id, name: teams.name, role: courseTeams.role })
    .from(courseTeams)
    .innerJoin(teams, eq(teams.id, courseTeams.teamId))
    .where(eq(courseTeams.courseId, courseId))
    .orderBy(asc(teams.name))
    .all();
  if (linked.length === 0) return [];
  const owner = db
    .select({ id: courses.userId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .get()?.id;
  const people = db
    .select({ teamId: teamMembers.teamId, name: users.name })
    .from(teamMembers)
    .innerJoin(users, eq(users.id, teamMembers.userId))
    .where(
      and(
        inArray(
          teamMembers.teamId,
          linked.map((t) => t.id),
        ),
        ne(teamMembers.userId, owner ?? ""),
      ),
    )
    .orderBy(asc(users.name))
    .all();
  return linked.map((t) => ({
    id: t.id,
    name: t.name,
    role: isRole(t.role) ? t.role : "editor",
    members: people.filter((p) => p.teamId === t.id).map((p) => p.name),
  }));
}

/** The manager's own teams that are not linked to the course yet; empty for anyone else. */
export async function listTeamCandidates(
  callerId: string,
  courseId: string,
): Promise<{ id: string; name: string }[]> {
  if (!managesCourse(callerId, courseId)) return [];
  const linked = getDb()
    .select({ id: courseTeams.teamId })
    .from(courseTeams)
    .where(eq(courseTeams.courseId, courseId));
  return getDb()
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(inArray(teams.id, myTeamIds(callerId)), notInArray(teams.id, linked)))
    .orderBy(asc(teams.name))
    .all();
}
