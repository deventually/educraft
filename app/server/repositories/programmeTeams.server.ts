/**
 * The teams of a programme (BESLUIT-2026-11-16-1): a programme has one or more teams, such as
 * the programme team and its module teams. Every member of one of them reads the programme, a
 * lead of one of them manages it (`programmes.server.ts`). An admin links and unlinks any team;
 * a team lead only their own team, to and from any programme (BESLUIT-2026-11-16-4). A
 * programme may have no team: an admin makes it so, and then only an admin sees it. The read helpers are for the programme
 * repository, which scopes its queries itself.
 */
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "../db.server";
import { divisions, programmeTeams, programmes, teamMembers, teams } from "../schema.server";

/** Who acts: the signed-in user's id and role. */
interface Actor {
  id: string;
  role: string;
}

const isAdmin = (a: Actor) => a.role === "admin";

/** An admin, or the lead of this team: the ones who choose where the team works. */
const speaksFor = (a: Actor, teamId: string) =>
  isAdmin(a) ||
  !!getDb()
    .select({ id: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, a.id),
        eq(teamMembers.isLead, true),
      ),
    )
    .get();

/** The teams of these programmes, by name, per programme id. Not scoped: callers scope. */
export function teamsOf(programmeIds: string[]): Map<string, { id: string; name: string }[]> {
  const out = new Map<string, { id: string; name: string }[]>();
  if (programmeIds.length === 0) return out;
  const rows = getDb()
    .select({ programmeId: programmeTeams.programmeId, id: teams.id, name: teams.name })
    .from(programmeTeams)
    .innerJoin(teams, eq(teams.id, programmeTeams.teamId))
    .where(inArray(programmeTeams.programmeId, programmeIds))
    .orderBy(asc(teams.name))
    .all();
  for (const { programmeId, id, name } of rows)
    out.set(programmeId, [...(out.get(programmeId) ?? []), { id, name }]);
  return out;
}

/** The user's teams among the programme's, with the lead stand. */
export function myTeams(userId: string, programmeId: string) {
  return getDb()
    .select({ teamId: teamMembers.teamId, isLead: teamMembers.isLead })
    .from(teamMembers)
    .innerJoin(programmeTeams, eq(programmeTeams.teamId, teamMembers.teamId))
    .where(and(eq(programmeTeams.programmeId, programmeId), eq(teamMembers.userId, userId)))
    .all();
}

/** Its teams' names, for one line of text ("Team A, Team B"). */
export const namesOf = (list: { name: string }[] = []) => list.map((t) => t.name).join(", ");

const exists = (table: typeof programmes | typeof teams, id: string) =>
  !!getDb().select({ id: table.id }).from(table).where(eq(table.id, id)).get();

/**
 * Links a team to a programme (an admin, or the lead of that team; linking twice changes
 * nothing). False otherwise.
 */
export async function linkProgrammeTeam(
  a: Actor,
  programmeId: string,
  teamId: string,
): Promise<boolean> {
  if (!exists(programmes, programmeId) || !exists(teams, teamId) || !speaksFor(a, teamId))
    return false;
  getDb()
    .insert(programmeTeams)
    .values({ programmeId, teamId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
  return true;
}

/**
 * Unlinks a team from a programme (an admin, or the lead of that team). Its members no longer
 * read the programme, and a course shows in it only while it is shared with one of the
 * remaining teams. The last team may go: the programme stays, for an admin.
 */
export async function unlinkProgrammeTeam(
  a: Actor,
  programmeId: string,
  teamId: string,
): Promise<"unlinked" | "refused"> {
  if (!speaksFor(a, teamId)) return "refused";
  const linked = and(
    eq(programmeTeams.programmeId, programmeId),
    eq(programmeTeams.teamId, teamId),
  );
  const result = getDb().delete(programmeTeams).where(linked).run();
  return result.changes > 0 ? "unlinked" : "refused";
}

/**
 * The programmes this team can still be linked to, for an admin or the team's lead (else
 * none): every programme of the institution it is not in, with its faculty. Only names: a
 * lead reads a programme itself once their team is in it.
 */
export async function programmeChoices(
  a: Actor,
  teamId: string,
): Promise<{ id: string; name: string; divisionName: string | null }[]> {
  if (!exists(teams, teamId) || !speaksFor(a, teamId)) return [];
  const inIt = getDb()
    .select({ id: programmeTeams.programmeId })
    .from(programmeTeams)
    .where(eq(programmeTeams.teamId, teamId))
    .all()
    .map((r) => r.id);
  return getDb()
    .select({ id: programmes.id, name: programmes.name, divisionName: divisions.name })
    .from(programmes)
    .leftJoin(divisions, eq(divisions.id, programmes.divisionId))
    .where(inIt.length ? notInArray(programmes.id, inIt) : undefined)
    .orderBy(asc(programmes.name))
    .limit(500)
    .all();
}
