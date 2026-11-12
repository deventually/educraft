/**
 * Teams of colleagues (P28.2). Repository rule: every exported function is `async`;
 * no better-sqlite3 API outside `db.server.ts`.
 *
 * Two kinds of callers:
 * - **admin** functions (`createTeam` … `setUserTeams`): the route has already checked
 *   `requireRole("admin")`; they act on any team.
 * - **lead** functions (`lead…`): scoped to the caller. Each goes through
 *   `getTeamForLead(callerId, teamId)`, which is `null` unless the caller leads that
 *   team, so a lead of team A can do nothing to team B and a plain member nothing at all.
 *
 * A lead never demotes or removes another lead; an admin does (`setLead`, `removeMember`).
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "../db.server";
import {
  announcementDismissals,
  announcements,
  invites,
  learningLines,
  programmeCourses,
  programmes,
  shares,
  slideTemplates,
  teamMembers,
  teams,
  users,
  type TeamRow,
} from "../schema.server";
import { createInvite, getUserByEmail } from "./users.server";
import {
  type TeamSettings,
  TeamSettingsSchema,
  parseTeamSettings,
} from "~/lib/features/teamSettings";

export interface TeamMember {
  userId: string;
  name: string;
  email: string | null;
  isLead: boolean;
}

export interface TeamWithMembers extends Omit<TeamRow, "settingsJson"> {
  members: TeamMember[];
  /** The team's choices for features, tools and models (P28.3). */
  settings: TeamSettings;
}

const withSettings = ({ settingsJson, ...team }: TeamRow) => ({
  ...team,
  settings: parseTeamSettings(settingsJson),
});

/** What a lead's write returns: done, or why not. */
export type LeadResult =
  | { ok: true }
  | { error: "notLead" | "noSuchUser" | "isLead" | "notMember" };

const NAME_MAX = 100;

function cleanName(name: string): string {
  const clean = name.trim().slice(0, NAME_MAX);
  if (!clean) throw new Error("A team needs a name");
  return clean;
}

function membersOf(teamIds: string[]): (TeamMember & { teamId: string })[] {
  if (teamIds.length === 0) return [];
  return getDb()
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      name: users.name,
      email: users.email,
      isLead: teamMembers.isLead,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(inArray(teamMembers.teamId, teamIds))
    .orderBy(asc(users.name))
    .all();
}

// ── Admin functions ──────────────────────────────────────────────────────────

export async function createTeam(name: string): Promise<TeamRow> {
  const row: TeamRow = {
    id: randomUUID(),
    name: cleanName(name),
    settingsJson: "{}",
    createdAt: new Date(),
    divisionId: null,
  };
  getDb().insert(teams).values(row).run();
  return row;
}

export async function renameTeam(id: string, name: string): Promise<void> {
  getDb()
    .update(teams)
    .set({ name: cleanName(name) })
    .where(eq(teams.id, id))
    .run();
}

/**
 * Remove the group only: the memberships go, the accounts stay, an open invite for the
 * team becomes a plain invite, and what was shared with it is private again (P28.4).
 */
export async function deleteTeam(id: string): Promise<void> {
  getDb().transaction((tx) => {
    // The team's programmes and the courses placed in them go with it.
    const own = tx.select({ id: programmes.id }).from(programmes).where(eq(programmes.teamId, id));
    tx.delete(programmeCourses).where(inArray(programmeCourses.programmeId, own)).run();
    tx.delete(learningLines).where(inArray(learningLines.programmeId, own)).run();
    tx.delete(programmes).where(eq(programmes.teamId, id)).run();
    tx.delete(shares).where(eq(shares.teamId, id)).run();
    // Announcements for the team go with it, with their dismissals.
    const told = tx
      .select({ id: announcements.id })
      .from(announcements)
      .where(and(eq(announcements.audience, "team"), eq(announcements.targetId, id)));
    tx.delete(announcementDismissals)
      .where(inArray(announcementDismissals.announcementId, told))
      .run();
    tx.delete(announcements)
      .where(and(eq(announcements.audience, "team"), eq(announcements.targetId, id)))
      .run();
    tx.delete(slideTemplates)
      .where(and(eq(slideTemplates.ownerKind, "team"), eq(slideTemplates.ownerId, id)))
      .run();
    tx.delete(teamMembers).where(eq(teamMembers.teamId, id)).run();
    tx.update(invites).set({ teamId: null }).where(eq(invites.teamId, id)).run();
    tx.delete(teams).where(eq(teams.id, id)).run();
  });
}

/** Every team, by name, with its members (the admin overview). Not user-scoped by design. */
export async function listTeams(): Promise<TeamWithMembers[]> {
  const rows = getDb().select().from(teams).orderBy(asc(teams.name)).all();
  const members = membersOf(rows.map((t) => t.id));
  return rows.map((t) => ({
    ...withSettings(t),
    members: members.filter((m) => m.teamId === t.id).map(({ teamId: _, ...m }) => m),
  }));
}

export async function getTeamWithMembers(id: string): Promise<TeamWithMembers | null> {
  const team = getDb().select().from(teams).where(eq(teams.id, id)).get();
  if (!team) return null;
  return { ...withSettings(team), members: membersOf([id]).map(({ teamId: _, ...m }) => m) };
}

/** Add `userId` to the team (once; a second add changes nothing). */
export async function addMember(teamId: string, userId: string): Promise<void> {
  getDb()
    .insert(teamMembers)
    .values({ teamId, userId, isLead: false, createdAt: new Date() })
    .onConflictDoNothing()
    .run();
}

/** Take `userId` out of the team; what they shared with it lapses (P28.4). */
export async function removeMember(teamId: string, userId: string): Promise<void> {
  getDb().transaction((tx) => {
    tx.delete(shares)
      .where(and(eq(shares.teamId, teamId), eq(shares.ownerUserId, userId)))
      .run();
    // Their courses leave the team's programmes.
    tx.delete(programmeCourses)
      .where(
        and(
          eq(programmeCourses.userId, userId),
          inArray(
            programmeCourses.programmeId,
            tx.select({ id: programmes.id }).from(programmes).where(eq(programmes.teamId, teamId)),
          ),
        ),
      )
      .run();
    tx.delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
      .run();
  });
}

/** Make a member lead, or take it away (admin). A non-member is left alone. */
export async function setLead(teamId: string, userId: string, isLead: boolean): Promise<void> {
  getDb()
    .update(teamMembers)
    .set({ isLead })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .run();
}

/**
 * The person page (admin): exactly these teams, lead in `leadIds` (a lead flag without the
 * membership, or an unknown team, is ignored).
 */
export async function setUserTeams(
  userId: string,
  teamIds: string[],
  leadIds: string[],
): Promise<void> {
  const db = getDb();
  const known = new Set(
    teamIds.length
      ? db
          .select({ id: teams.id })
          .from(teams)
          .where(inArray(teams.id, teamIds))
          .all()
          .map((t) => t.id)
      : [],
  );
  const leads = new Set(leadIds);
  db.transaction((tx) => {
    // Shares with a team the user leaves lapse (P28.4).
    tx.delete(shares)
      .where(
        known.size
          ? and(eq(shares.ownerUserId, userId), notInArray(shares.teamId, [...known]))
          : eq(shares.ownerUserId, userId),
      )
      .run();
    tx.delete(teamMembers).where(eq(teamMembers.userId, userId)).run();
    for (const teamId of known) {
      tx.insert(teamMembers)
        .values({ teamId, userId, isLead: leads.has(teamId), createdAt: new Date() })
        .run();
    }
  });
}

/** The teams `userId` is in, by name, with their own lead stand. */
export async function listTeamsForUser(
  userId: string,
): Promise<{ id: string; name: string; isLead: boolean }[]> {
  return getDb()
    .select({ id: teams.id, name: teams.name, isLead: teamMembers.isLead })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teams.name))
    .all();
}

/**
 * Store a team's choices (P28.3). Validated here; what the instance has Off is kept but
 * never counts (the rule checks the instance first).
 */
export async function setTeamSettings(teamId: string, settings: TeamSettings): Promise<void> {
  const clean = TeamSettingsSchema.parse(settings);
  getDb()
    .update(teams)
    .set({ settingsJson: JSON.stringify(clean) })
    .where(eq(teams.id, teamId))
    .run();
}

/** The teams `userId` is in, with their choices: the team layer of the rule. */
export async function listTeamSettingsForUser(
  userId: string,
): Promise<{ id: string; name: string; settings: TeamSettings }[]> {
  return getDb()
    .select({ id: teams.id, name: teams.name, settingsJson: teams.settingsJson })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, userId))
    .orderBy(asc(teams.name))
    .all()
    .map((t) => ({ id: t.id, name: t.name, settings: parseTeamSettings(t.settingsJson) }));
}

/** The new account of a team invite joins that team; a team that is gone is ignored. */
export async function joinTeamFromInvite(teamId: string, userId: string): Promise<void> {
  const team = getDb().select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).get();
  if (team) await addMember(teamId, userId);
}

// ── Lead functions: scoped to the caller ─────────────────────────────────────

/** The team with its members when `callerId` leads it; otherwise `null`. */
export async function getTeamForLead(
  callerId: string,
  teamId: string,
): Promise<TeamWithMembers | null> {
  const stand = getDb()
    .select({ isLead: teamMembers.isLead })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, callerId)))
    .get();
  if (!stand?.isLead) return null;
  return getTeamWithMembers(teamId);
}

/** Add a colleague by their exact e-mail address (no browsing through accounts). */
export async function leadAddMember(
  callerId: string,
  teamId: string,
  email: string,
): Promise<LeadResult> {
  if (!(await getTeamForLead(callerId, teamId))) return { error: "notLead" };
  const user = email.trim() ? await getUserByEmail(email.trim()) : null;
  if (!user) return { error: "noSuchUser" };
  await addMember(teamId, user.id);
  return { ok: true };
}

/** Remove a plain member; another lead is the admin's to remove. */
export async function leadRemoveMember(
  callerId: string,
  teamId: string,
  memberId: string,
): Promise<LeadResult> {
  const team = await getTeamForLead(callerId, teamId);
  if (!team) return { error: "notLead" };
  const member = team.members.find((m) => m.userId === memberId);
  if (!member) return { error: "notMember" };
  if (member.isLead) return { error: "isLead" };
  await removeMember(teamId, memberId);
  return { ok: true };
}

/** Make a member of this team lead too (BESLUIT-2026-11-05-5). */
export async function leadMakeLead(
  callerId: string,
  teamId: string,
  memberId: string,
): Promise<LeadResult> {
  const team = await getTeamForLead(callerId, teamId);
  if (!team) return { error: "notLead" };
  if (!team.members.some((m) => m.userId === memberId)) return { error: "notMember" };
  await setLead(teamId, memberId, true);
  return { ok: true };
}

/** Stop being lead of this team; you stay a member. */
export async function leadStepDown(callerId: string, teamId: string): Promise<LeadResult> {
  if (!(await getTeamForLead(callerId, teamId))) return { error: "notLead" };
  await setLead(teamId, callerId, false);
  return { ok: true };
}

/** A lead sets their own team's choices (P28.3), within the instance's limits. */
export async function leadSetSettings(
  callerId: string,
  teamId: string,
  settings: TeamSettings,
): Promise<LeadResult> {
  if (!(await getTeamForLead(callerId, teamId))) return { error: "notLead" };
  await setTeamSettings(teamId, settings);
  return { ok: true };
}

/** An invite link that makes the new account a member of this team; always a teacher. */
export async function leadCreateInvite(
  callerId: string,
  teamId: string,
  opts: { note?: string | null; expiresAt?: Date | null },
): Promise<{ token: string } | { error: "notLead" }> {
  if (!(await getTeamForLead(callerId, teamId))) return { error: "notLead" };
  const invite = await createInvite({
    role: "teacher", // invites never make admins (BESLUIT-2026-07-03-2)
    note: opts.note ?? null,
    expiresAt: opts.expiresAt ?? null,
    createdByUserId: callerId,
    teamId,
  });
  return { token: invite.token };
}
