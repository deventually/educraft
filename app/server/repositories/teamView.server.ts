/**
 * What a teacher sees of the teams they are in (plan step 5, BESLUIT-2026-11-16-7): the
 * overview of their own teams, and a plain member's read-only view of one of them. Both are
 * scoped to the caller in the WHERE clause; a member sees names and who leads, never e-mail
 * addresses or the team's choices. Managing a team stays in `teams.server.ts`.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db.server";
import { teamMembers, teams, users } from "../schema.server";

export interface TeamOverviewRow {
  id: string;
  name: string;
  memberCount: number;
  leads: string[];
  isLead: boolean;
}

/** The teams `userId` is in, by name, with their member count and leads. */
export async function listMyTeams(userId: string): Promise<TeamOverviewRow[]> {
  const db = getDb();
  const mine = db
    .select({ id: teams.id, name: teams.name, isLead: teamMembers.isLead })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teams.name))
    .all();
  if (mine.length === 0) return [];
  const rows = db
    .select({ teamId: teamMembers.teamId, name: users.name, isLead: teamMembers.isLead })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      inArray(
        teamMembers.teamId,
        mine.map((t) => t.id),
      ),
    )
    .orderBy(asc(users.name))
    .all();
  return mine.map((t) => {
    const here = rows.filter((r) => r.teamId === t.id);
    return {
      ...t,
      memberCount: here.length,
      leads: here.filter((r) => r.isLead).map((r) => r.name),
    };
  });
}

/** A plain member's view of their own team: names and who leads; `null` for anyone else. */
export async function getTeamForMember(callerId: string, teamId: string) {
  const db = getDb();
  const team = db
    .select({ id: teams.id, name: teams.name })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)))
    .get();
  if (!team) return null;
  const members = db
    .select({ userId: teamMembers.userId, name: users.name, isLead: teamMembers.isLead })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))
    .orderBy(asc(users.name))
    .all();
  return { ...team, members };
}
