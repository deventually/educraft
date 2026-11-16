/**
 * The teams of a programme (BESLUIT-2026-11-16-1): a programme has one or more teams, such as
 * the programme team and its module teams. Every member of one of them reads the programme, a
 * lead of one of them manages it (`programmes.server.ts`). Linking and unlinking is for an admin
 * or such a lead (BESLUIT-2026-11-16-3); a programme always keeps at least one team. The read helpers are for the programme
 * repository, which scopes its queries itself.
 */
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb } from "../db.server";
import { programmeTeams, programmes, teamMembers, teams } from "../schema.server";

/** Who acts: the signed-in user's id and role. */
interface Actor {
  id: string;
  role: string;
}

const isAdmin = (a: Actor) => a.role === "admin";

/** An admin, or a lead of one of the programme's teams: the ones who choose its teams. */
const choosesTeams = (a: Actor, programmeId: string) =>
  isAdmin(a) || myTeams(a.id, programmeId).some((m) => m.isLead);

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
 * Links a team to a programme (an admin or a lead of one of its teams; linking twice changes
 * nothing). False otherwise.
 */
export async function linkProgrammeTeam(
  a: Actor,
  programmeId: string,
  teamId: string,
): Promise<boolean> {
  if (!exists(programmes, programmeId) || !exists(teams, teamId) || !choosesTeams(a, programmeId))
    return false;
  getDb()
    .insert(programmeTeams)
    .values({ programmeId, teamId, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
  return true;
}

/**
 * Unlinks a team from a programme (an admin or a lead of one of its teams). Its members no longer read the programme, and
 * a course shows in it only while it is shared with one of the remaining teams. Never the last
 * team: a programme without a team would be no one's.
 */
export async function unlinkProgrammeTeam(
  a: Actor,
  programmeId: string,
  teamId: string,
): Promise<"unlinked" | "lastTeam" | "refused"> {
  if (!choosesTeams(a, programmeId)) return "refused";
  const db = getDb();
  const linked = and(
    eq(programmeTeams.programmeId, programmeId),
    eq(programmeTeams.teamId, teamId),
  );
  if (!db.select({ id: programmeTeams.teamId }).from(programmeTeams).where(linked).get())
    return "refused";
  const [{ n }] = db
    .select({ n: count() })
    .from(programmeTeams)
    .where(eq(programmeTeams.programmeId, programmeId))
    .all() as [{ n: number }];
  if (n <= 1) return "lastTeam";
  db.delete(programmeTeams).where(linked).run();
  return "unlinked";
}
