import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Teams = typeof import("~/server/repositories/teams.server");
type Users = typeof import("~/server/repositories/users.server");
let teams: Teams;
let users: Users;

beforeAll(async () => {
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
});

let n = 0;
async function person(name: string, role: "teacher" | "admin" = "teacher") {
  n++;
  return users.createUser({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}.${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
}

/** A team with a lead and a plain member. */
async function teamWithLead(name: string) {
  const team = await teams.createTeam(name);
  const lead = await person(`${name} Lead`);
  const member = await person(`${name} Member`);
  await teams.addMember(team.id, lead.id);
  await teams.setLead(team.id, lead.id, true);
  await teams.addMember(team.id, member.id);
  return { team, lead, member };
}

const memberIds = async (teamId: string) =>
  ((await teams.getTeamWithMembers(teamId))?.members ?? []).map((m) => m.userId).sort();

describe("teams — admin functions (P28.2)", () => {
  it("creates, renames and lists a team with its members and leads", async () => {
    const { team, lead, member } = await teamWithLead("Verpleegkunde");
    await teams.renameTeam(team.id, "Verpleegkunde hbo");
    const all = await teams.listTeams();
    const row = all.find((t) => t.id === team.id);
    expect(row?.name).toBe("Verpleegkunde hbo");
    expect(row?.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: lead.id, isLead: true, name: lead.name }),
        expect.objectContaining({ userId: member.id, isLead: false, email: member.email }),
      ]),
    );
  });

  it("refuses an empty team name", async () => {
    await expect(teams.createTeam("  ")).rejects.toThrow();
  });

  it("adds a member once (unique on team + user) and removes them", async () => {
    const team = await teams.createTeam("Uniek");
    const p = await person("Once");
    await teams.addMember(team.id, p.id);
    await teams.addMember(team.id, p.id);
    expect(await memberIds(team.id)).toEqual([p.id]);
    await teams.removeMember(team.id, p.id);
    expect(await memberIds(team.id)).toEqual([]);
  });

  it("sets a person's teams and leads from the person page in one go", async () => {
    const a = await teams.createTeam("A");
    const b = await teams.createTeam("B");
    const p = await person("Multi");
    await teams.setUserTeams(p.id, [a.id, b.id], [b.id]);
    expect(await teams.listTeamsForUser(p.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: a.id, isLead: false }),
        expect.objectContaining({ id: b.id, isLead: true }),
      ]),
    );
    // A lead flag without the membership is ignored; an unknown team too.
    await teams.setUserTeams(p.id, [a.id, "no-such-team"], [b.id]);
    expect(await teams.listTeamsForUser(p.id)).toEqual([
      expect.objectContaining({ id: a.id, isLead: false }),
    ]);
  });

  it("deleting a team removes the group only: members keep their accounts", async () => {
    const { team, member } = await teamWithLead("Opheffen");
    const invite = await users.createInvite({ role: "teacher", teamId: team.id });
    await teams.deleteTeam(team.id);
    expect(await teams.getTeamWithMembers(team.id)).toBeNull();
    expect(await teams.listTeamsForUser(member.id)).toEqual([]);
    expect(await users.getUserById(member.id)).not.toBeNull();
    // An open invite for the team still works, as a plain invite.
    expect((await users.getInvite(invite.token))?.teamId).toBeNull();
  });

  it("deleting an account removes its memberships", async () => {
    const { team, member } = await teamWithLead("Weg");
    await users.deleteUserCascade(member.id);
    expect(await memberIds(team.id)).not.toContain(member.id);
  });
});

describe("teams — a lead's functions are scoped to their own team (P28.2)", () => {
  it("getTeamForLead gives the team only to its lead", async () => {
    const a = await teamWithLead("Scope A");
    const b = await teamWithLead("Scope B");
    expect((await teams.getTeamForLead(a.lead.id, a.team.id))?.id).toBe(a.team.id);
    expect(await teams.getTeamForLead(a.lead.id, b.team.id)).toBeNull();
    expect(await teams.getTeamForLead(a.member.id, a.team.id)).toBeNull();
    expect(await teams.getTeamForLead(a.lead.id, "no-such-team")).toBeNull();
  });

  it("a lead adds a member by exact e-mail address", async () => {
    const { team, lead } = await teamWithLead("Mail");
    const p = await person("New Colleague");
    expect(await teams.leadAddMember(lead.id, team.id, p.email!)).toEqual({ ok: true });
    expect(await memberIds(team.id)).toContain(p.id);
    expect(await teams.leadAddMember(lead.id, team.id, "nobody@school.nl")).toEqual({
      error: "noSuchUser",
    });
    // No browsing: part of an address finds nobody.
    expect(await teams.leadAddMember(lead.id, team.id, p.email!.slice(0, 5))).toEqual({
      error: "noSuchUser",
    });
  });

  it("a lead removes a plain member, but never another lead", async () => {
    const { team, lead, member } = await teamWithLead("Remove");
    const other = await person("Other Lead");
    await teams.addMember(team.id, other.id);
    await teams.setLead(team.id, other.id, true);
    expect(await teams.leadRemoveMember(lead.id, team.id, other.id)).toEqual({
      error: "isLead",
    });
    expect(await memberIds(team.id)).toContain(other.id);
    expect(await teams.leadRemoveMember(lead.id, team.id, member.id)).toEqual({ ok: true });
    expect(await memberIds(team.id)).not.toContain(member.id);
  });

  it("a lead makes a member lead; only an admin takes it away", async () => {
    const { team, lead, member } = await teamWithLead("Promote");
    expect(await teams.leadMakeLead(lead.id, team.id, member.id)).toEqual({ ok: true });
    expect((await teams.getTeamForLead(member.id, team.id))?.id).toBe(team.id);
    // There is no lead function to demote someone else; the admin's setLead does it.
    expect("leadRemoveLead" in teams).toBe(false);
    await teams.setLead(team.id, member.id, false);
    expect(await teams.getTeamForLead(member.id, team.id)).toBeNull();
  });

  it("a lead can only make a member of this team lead", async () => {
    const { team, lead } = await teamWithLead("Outsider");
    const outsider = await person("Outsider");
    expect(await teams.leadMakeLead(lead.id, team.id, outsider.id)).toEqual({
      error: "notMember",
    });
    expect(await memberIds(team.id)).not.toContain(outsider.id);
  });

  it("a lead steps down and stays a member", async () => {
    const { team, lead } = await teamWithLead("Step");
    expect(await teams.leadStepDown(lead.id, team.id)).toEqual({ ok: true });
    expect(await teams.getTeamForLead(lead.id, team.id)).toBeNull();
    expect(await memberIds(team.id)).toContain(lead.id);
  });

  it("a lead of team A can do nothing to team B; a plain member nothing at all", async () => {
    const a = await teamWithLead("Iso A");
    const b = await teamWithLead("Iso B");
    const stranger = await person("Stranger");
    for (const [actor, team] of [
      [a.lead.id, b.team.id],
      [a.member.id, a.team.id],
    ] as const) {
      expect(await teams.leadAddMember(actor, team, stranger.email!)).toEqual({
        error: "notLead",
      });
      expect(await teams.leadRemoveMember(actor, team, b.member.id)).toEqual({
        error: "notLead",
      });
      expect(await teams.leadMakeLead(actor, team, b.member.id)).toEqual({ error: "notLead" });
      expect(await teams.leadCreateInvite(actor, team, {})).toEqual({ error: "notLead" });
    }
    expect(await memberIds(b.team.id)).toEqual([b.lead.id, b.member.id].sort());
  });

  it("a lead's invite is always a teacher invite for this team", async () => {
    const { team, lead } = await teamWithLead("Invite");
    const res = await teams.leadCreateInvite(lead.id, team.id, { note: "Nieuw" });
    if (!("token" in res)) throw new Error("expected an invite");
    const invite = await users.getInvite(res.token);
    expect(invite).toMatchObject({ role: "teacher", teamId: team.id, createdByUserId: lead.id });
  });

  it("joinTeamFromInvite adds the new account, and ignores a team that is gone", async () => {
    const team = await teams.createTeam("Join");
    const p = await person("Joiner");
    await teams.joinTeamFromInvite(team.id, p.id);
    expect(await memberIds(team.id)).toEqual([p.id]);
    await expect(teams.joinTeamFromInvite("gone", p.id)).resolves.toBeUndefined();
  });
});
