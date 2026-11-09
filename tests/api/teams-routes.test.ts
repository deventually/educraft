import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { flashKeyOf } from "../helpers/flash";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Who is signed in; isOwner stays real (it reads the stored owner id).
const { currentUser } = vi.hoisted(() => ({
  currentUser: { value: null as unknown },
}));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return {
    ...actual,
    requireUser: vi.fn(async () => currentUser.value),
    requireRole: vi.fn(async (_req: Request, ...roles: string[]) => {
      const u = currentUser.value as { role: string };
      if (!roles.includes(u.role)) throw new Response("Forbidden", { status: 403 });
      return u;
    }),
  };
});
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let adminTeams: typeof import("~/routes/admin.teams");
let adminTeam: typeof import("~/routes/admin.teams.$id");
let list: typeof import("~/routes/admin.users");
let person: typeof import("~/routes/admin.users.$id");
let leadPage: typeof import("~/routes/teams.$id");
let invite: typeof import("~/routes/invite");

beforeAll(async () => {
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  adminTeams = await import("~/routes/admin.teams");
  adminTeam = await import("~/routes/admin.teams.$id");
  list = await import("~/routes/admin.users");
  person = await import("~/routes/admin.users.$id");
  leadPage = await import("~/routes/teams.$id");
  invite = await import("~/routes/invite");
});

let n = 0;
async function mk(name: string, role: "teacher" | "admin" = "teacher") {
  n++;
  return users.createUser({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}.${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
}
const as = (u: { id: string; role: string; name?: string }) => {
  currentUser.value = { email: null, name: "x", ...u };
};

let admin: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  admin ??= await mk("Admin", "admin");
  as(admin);
});

function post(fields: Record<string, string | string[]>, path = "/x"): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}
const get = (path = "/x") => new Request(`http://localhost${path}`);
const call = <F extends (a: never) => unknown>(fn: F, args: object) =>
  fn({ params: {}, context: {}, ...args } as never) as Promise<Awaited<ReturnType<F>>>;
async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}
const memberIds = async (teamId: string) =>
  ((await teams.getTeamWithMembers(teamId))?.members ?? []).map((m) => m.userId);

describe("/admin/teams, the list (P28.2, like the user list)", () => {
  it("creates a team and goes straight to its page", async () => {
    const res = await call(adminTeams.action, {
      request: post({ intent: "create", name: "Verpleegkunde" }),
    });
    expect(res).toBeInstanceOf(Response);
    const location = (res as Response).headers.get("Location") ?? "";
    expect(location).toMatch(/^\/admin\/teams\/.+/);
    const id = location.split("/").pop()!;
    expect((await teams.getTeamWithMembers(id))?.name).toBe("Verpleegkunde");
  });

  it("refuses an empty name", async () => {
    const res = (await call(adminTeams.action, {
      request: post({ intent: "create", name: " " }),
    })) as { error?: string };
    expect(res.error).toBe("nameRequired");
  });

  it("shows one row per team: members, leads, and searches on team or person", async () => {
    const team = await teams.createTeam("Zoekteam Zorg");
    const lead = await mk("Zoek Leider");
    const plain = await mk("Zoek Lid");
    await teams.addMember(team.id, lead.id);
    await teams.addMember(team.id, plain.id);
    await teams.setLead(team.id, lead.id, true);
    await teams.createTeam("Zoekteam Techniek");

    const all = await call(adminTeams.loader, { request: get("/admin/teams") });
    const row = all.teams.find((t) => t.id === team.id)!;
    expect(row).toEqual({
      id: team.id,
      name: "Zoekteam Zorg",
      memberCount: 2,
      leads: ["Zoek Leider"],
    });

    const byTeam = await call(adminTeams.loader, { request: get("/admin/teams?q=techniek") });
    expect(byTeam.teams.map((t) => t.name)).toEqual(["Zoekteam Techniek"]);
    expect(byTeam.q).toBe("techniek");
    const byPerson = await call(adminTeams.loader, { request: get("/admin/teams?q=zoek%20lid") });
    expect(byPerson.teams.map((t) => t.name)).toEqual(["Zoekteam Zorg"]);
  });

  it("is admin only: a teacher, even a lead, gets a 403", async () => {
    const team = await teams.createTeam("Alleen beheer");
    const lead = await mk("Lead X");
    await teams.addMember(team.id, lead.id);
    await teams.setLead(team.id, lead.id, true);
    as(lead);
    expect(await status(call(adminTeams.loader, { request: get() }))).toBe(403);
    expect(
      await status(call(adminTeams.action, { request: post({ intent: "create", name: "Y" }) })),
    ).toBe(403);
    expect(await status(call(adminTeam.loader, { request: get(), params: { id: team.id } }))).toBe(
      403,
    );
    expect(
      await status(
        call(adminTeam.action, {
          request: post({ intent: "rename", name: "Z" }),
          params: { id: team.id },
        }),
      ),
    ).toBe(403);
  });
});

describe("/admin/teams/:id, the team page", () => {
  it("is a 404 for an unknown team", async () => {
    expect(await status(call(adminTeam.loader, { request: get(), params: { id: "nope" } }))).toBe(
      404,
    );
    expect(
      await status(
        call(adminTeam.action, {
          request: post({ intent: "rename", name: "X" }),
          params: { id: "nope" },
        }),
      ),
    ).toBe(404);
  });

  it("offers every active account that is not yet a member to add", async () => {
    const team = await teams.createTeam("Kandidaten");
    const inTeam = await mk("Kandidaat Lid");
    const outside = await mk("Kandidaat Buiten");
    const off = await mk("Kandidaat Uit");
    await users.setUserDisabled(off.id, true);
    await teams.addMember(team.id, inTeam.id);
    const data = await call(adminTeam.loader, { request: get(), params: { id: team.id } });
    expect(data.team.members.map((m) => m.userId)).toEqual([inTeam.id]);
    const ids = data.candidates.map((c) => c.id);
    expect(ids).toContain(outside.id);
    expect(ids).not.toContain(inTeam.id);
    expect(ids).not.toContain(off.id);
    const names = data.candidates.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(data.candidates.find((c) => c.id === outside.id)).toEqual({
      id: outside.id,
      name: "Kandidaat Buiten",
      email: outside.email,
    });
  });

  it("adds several people at once and ignores an unknown id", async () => {
    const team = await teams.createTeam("Veel tegelijk");
    const a = await mk("Veel A");
    const b = await mk("Veel B");
    const res = await call(adminTeam.action, {
      request: post({ intent: "addMembers", userIds: [a.id, b.id, "ghost"] }),
      params: { id: team.id },
    });
    expect(res).toEqual({ saved: true });
    expect((await memberIds(team.id)).sort()).toEqual([a.id, b.id].sort());
    const none = await call(adminTeam.action, {
      request: post({ intent: "addMembers" }),
      params: { id: team.id },
    });
    expect(none).toEqual({ error: "noneSelected" });
  });

  it("renames, makes a lead, takes it away, removes a member and deletes the team", async () => {
    const team = await teams.createTeam("Beheer");
    const a = await mk("Docent A");
    await teams.addMember(team.id, a.id);
    const at = (fields: Record<string, string>) =>
      call(adminTeam.action, { request: post(fields), params: { id: team.id } });

    expect(await at({ intent: "rename", name: "Beheer 2" })).toEqual({ saved: true });
    expect((await teams.getTeamWithMembers(team.id))?.name).toBe("Beheer 2");
    expect(await at({ intent: "rename", name: " " })).toEqual({ error: "nameRequired" });

    await at({ intent: "setLead", userId: a.id, lead: "1" });
    expect(await teams.getTeamForLead(a.id, team.id)).not.toBeNull();
    await at({ intent: "setLead", userId: a.id });
    expect(await teams.getTeamForLead(a.id, team.id)).toBeNull();
    await at({ intent: "removeMember", userId: a.id });
    expect(await memberIds(team.id)).toEqual([]);

    const gone = await at({ intent: "delete" });
    expect(gone).toBeInstanceOf(Response);
    expect((gone as Response).headers.get("Location")).toBe("/admin/teams");
    expect(await flashKeyOf(gone)).toBe("teamDeleted");
    expect(await teams.getTeamWithMembers(team.id)).toBeNull();
  });

  it("acts on the team in the URL only; a teamId in the form is ignored", async () => {
    const mine = await teams.createTeam("URL team");
    const other = await teams.createTeam("Ander team");
    await call(adminTeam.action, {
      request: post({ intent: "rename", name: "Hernoemd", teamId: other.id }),
      params: { id: mine.id },
    });
    expect((await teams.getTeamWithMembers(mine.id))?.name).toBe("Hernoemd");
    expect((await teams.getTeamWithMembers(other.id))?.name).toBe("Ander team");
  });
});

describe("the person page and the list know teams (P28.2)", () => {
  it("the person page sets a person's teams and leads", async () => {
    const a = await teams.createTeam("PA");
    const b = await teams.createTeam("PB");
    const t = await mk("Person Teams");
    const res = (await call(person.action, {
      request: post({ intent: "teams", teams: [a.id, b.id], leads: [b.id] }),
      params: { id: t.id },
    })) as { saved?: boolean };
    expect(res.saved).toBe(true);
    const data = await call(person.loader, { request: get(), params: { id: t.id } });
    expect(data.teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: a.id, member: true, lead: false }),
        expect.objectContaining({ id: b.id, member: true, lead: true }),
      ]),
    );
  });

  it("a regular admin cannot set the teams of another admin", async () => {
    await settings.setOwnerUserId(null);
    const team = await teams.createTeam("PC");
    const other = await mk("Other Admin", "admin");
    const res = (await call(person.action, {
      request: post({ intent: "teams", teams: [team.id] }),
      params: { id: other.id },
    })) as { error?: string };
    expect(res.error).toBe("ownerOnly");
    expect(await teams.listTeamsForUser(other.id)).toEqual([]);
  });

  it("the list filters on team and Add mints an invite for a team", async () => {
    const team = await teams.createTeam("Filter");
    const inTeam = await mk("In Team");
    await mk("Not In Team");
    await teams.addMember(team.id, inTeam.id);
    const minted = (await call(list.action, {
      request: post({ intent: "mint", teamId: team.id, note: "Team Invite" }),
    })) as { link: string };
    const token = minted.link.split("/invite/")[1];
    expect((await users.getInvite(token!))?.teamId).toBe(team.id);
    const data = await call(list.loader, { request: get(`/admin/users?team=${team.id}`) });
    expect(data.people.map((p) => p.name).sort()).toEqual(["In Team", "Team Invite"]);
    expect(data.teams.map((t) => t.id)).toContain(team.id);
  });

  it("a direct account (owner) joins the chosen team", async () => {
    await settings.setOwnerUserId(admin.id);
    const team = await teams.createTeam("Direct");
    await call(list.action, {
      request: post({
        intent: "createAccount",
        name: "Direct Person",
        email: "direct.person@school.nl",
        role: "teacher",
        passwordMode: "link",
        teamId: team.id,
      }),
    });
    const created = await users.getUserByEmail("direct.person@school.nl");
    expect(await memberIds(team.id)).toEqual([created!.id]);
    await settings.setOwnerUserId(null);
  });
});

describe("redeeming a team invite (P28.2)", () => {
  it("makes the new account a member of that team, as a teacher", async () => {
    const team = await teams.createTeam("Uitnodiging");
    const inv = await users.createInvite({ role: "teacher", teamId: team.id });
    await invite.action({
      params: { token: inv.token },
      request: post({
        name: "Nieuw Lid",
        email: "nieuw.lid@school.nl",
        password: "supersecret10",
        confirm: "supersecret10",
      }),
    } as never);
    const u = await users.getUserByEmail("nieuw.lid@school.nl");
    expect(u?.role).toBe("teacher");
    expect(await memberIds(team.id)).toEqual([u!.id]);
  });
});

describe("/teams/:id — the lead's page (P28.2)", () => {
  async function setup() {
    const team = await teams.createTeam(`Lead team ${++n}`);
    const lead = await mk("The Lead");
    const member = await mk("The Member");
    await teams.addMember(team.id, lead.id);
    await teams.setLead(team.id, lead.id, true);
    await teams.addMember(team.id, member.id);
    return { team, lead, member };
  }
  const act = (teamId: string, fields: Record<string, string>) =>
    call(leadPage.action, { request: post(fields), params: { id: teamId } });

  it("shows the lead their team: members with name and e-mail", async () => {
    const { team, lead, member } = await setup();
    as(lead);
    const data = await call(leadPage.loader, { request: get(), params: { id: team.id } });
    expect(data.team.name).toBe(team.name);
    expect(data.team.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: member.id, email: member.email, isLead: false }),
      ]),
    );
    expect(data.selfId).toBe(lead.id);
  });

  it("is a 404 for a plain member, a lead of another team and an admin who is no lead", async () => {
    const { team, member } = await setup();
    const other = await setup();
    for (const who of [member, other.lead, admin]) {
      as(who);
      expect(
        await status(call(leadPage.loader, { request: get(), params: { id: team.id } })),
        who.name,
      ).toBe(404);
      expect(
        await status(act(team.id, { intent: "addMember", email: other.member.email! })),
        who.name,
      ).toBe(404);
    }
    expect(await memberIds(team.id)).not.toContain(other.member.id);
  });

  it("adds by exact e-mail, makes a member lead, and removes a plain member", async () => {
    const { team, lead, member } = await setup();
    const colleague = await mk("Colleague");
    as(lead);
    expect(await act(team.id, { intent: "addMember", email: colleague.email! })).toEqual({
      saved: true,
    });
    expect(await act(team.id, { intent: "addMember", email: "nobody@school.nl" })).toEqual({
      error: "noSuchUser",
    });
    expect(await act(team.id, { intent: "makeLead", userId: member.id })).toEqual({
      saved: true,
    });
    // Now a lead: a lead cannot remove them.
    expect(await act(team.id, { intent: "removeMember", userId: member.id })).toEqual({
      error: "isLead",
    });
    expect(await act(team.id, { intent: "removeMember", userId: colleague.id })).toEqual({
      saved: true,
    });
    expect((await memberIds(team.id)).sort()).toEqual([lead.id, member.id].sort());
  });

  it("mints a teacher invite for this team", async () => {
    const { team, lead } = await setup();
    as(lead);
    const res = (await act(team.id, { intent: "invite", note: "Collega" })) as { link: string };
    const token = res.link.split("/invite/")[1];
    expect(await users.getInvite(token!)).toMatchObject({ role: "teacher", teamId: team.id });
  });

  it("steps down and goes back to the account page", async () => {
    const { team, lead } = await setup();
    as(lead);
    const res = (await act(team.id, { intent: "stepDown" })) as unknown as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/account");
    expect(await flashKeyOf(res)).toBe("steppedDown");
    expect(await teams.getTeamForLead(lead.id, team.id)).toBeNull();
    expect(await memberIds(team.id)).toContain(lead.id);
  });
});

describe("a team's choices for parts, tools and models (P28.3)", () => {
  const TOOL = "math-grading";
  beforeEach(async () => {
    await settings.setToolStand(TOOL, null);
    await settings.setFeatureStand("courses", "on");
    await settings.setEnabledModels(["claude-sonnet-4-6", "claude-haiku-4-5"]);
  });

  async function leadOfNewTeam() {
    const team = await teams.createTeam(`Choice team ${++n}`);
    const lead = await mk("Choice Lead");
    await teams.addMember(team.id, lead.id);
    await teams.setLead(team.id, lead.id, true);
    return { team, lead };
  }
  const stored = async (id: string) => (await teams.getTeamWithMembers(id))!.settings;

  it("the lead's page offers only what the instance has not Off", async () => {
    const { team, lead } = await leadOfNewTeam();
    await settings.setFeatureStand("courses", "off");
    await settings.setToolStand(TOOL, "off");
    as(lead);
    const data = await call(leadPage.loader, { request: get(), params: { id: team.id } });
    expect(data.offer.features.map((f) => f.id)).not.toContain("courses");
    expect(data.offer.features.map((f) => f.id)).toContain("portfolio");
    expect(data.offer.tools.map((t) => t.slug)).not.toContain(TOOL);
    expect(data.offer.models.map((m) => m.id).sort()).toEqual(
      ["claude-haiku-4-5", "claude-sonnet-4-6"].sort(),
    );
  });

  it("a lead stores choices; an empty choice is no choice; Off on the instance stays stored", async () => {
    const { team, lead } = await leadOfNewTeam();
    await teams.setTeamSettings(team.id, {
      features: { courses: "off" },
      tools: {},
      models: null,
    });
    await settings.setFeatureStand("courses", "off");
    as(lead);
    const res = await call(leadPage.action, {
      request: post({
        intent: "settings",
        "feature:portfolio": "on",
        "feature:utilities": "",
        [`tool:${TOOL}`]: "off",
        modelMode: "own",
        models: ["claude-haiku-4-5", "claude-opus-4-8"],
      }),
      params: { id: team.id },
    });
    expect(res).toEqual({ saved: true });
    expect(await stored(team.id)).toEqual({
      features: { courses: "off", portfolio: "on" },
      tools: { [TOOL]: "off" },
      // Only models the instance has on are kept.
      models: ["claude-haiku-4-5"],
    });
  });

  it("an own model set may not be empty; follows the instance clears it", async () => {
    const { team, lead } = await leadOfNewTeam();
    as(lead);
    const act = (fields: Record<string, string | string[]>) =>
      call(leadPage.action, {
        request: post({ intent: "settings", ...fields }),
        params: { id: team.id },
      });
    expect(await act({ modelMode: "own" })).toEqual({ error: "atLeastOne" });
    await act({ modelMode: "own", models: "claude-sonnet-4-6" });
    expect((await stored(team.id)).models).toEqual(["claude-sonnet-4-6"]);
    await act({ modelMode: "inherit", models: "claude-sonnet-4-6" });
    expect((await stored(team.id)).models).toBeNull();
  });

  it("refuses an unknown choice", async () => {
    const { team, lead } = await leadOfNewTeam();
    as(lead);
    expect(
      await call(leadPage.action, {
        request: post({ intent: "settings", "feature:portfolio": "maybe" }),
        params: { id: team.id },
      }),
    ).toEqual({ error: "invalid" });
  });

  it("the admin sets any team's choices on /admin/teams/:id", async () => {
    const { team } = await leadOfNewTeam();
    const data = await call(adminTeam.loader, { request: get(), params: { id: team.id } });
    expect(data.offer.features.length).toBeGreaterThan(0);
    expect(data.team.settings).toEqual({
      features: {},
      tools: {},
      models: null,
    });
    const res = await call(adminTeam.action, {
      request: post({ intent: "settings", "feature:courses": "off", "feature:roleAgents": "off" }),
      params: { id: team.id },
    });
    expect(res).toEqual({ saved: true });
    // Role agents are not a team's choice (BESLUIT-2026-11-05-11): that field is ignored.
    expect((await stored(team.id)).features).toEqual({ courses: "off" });
  });
});
