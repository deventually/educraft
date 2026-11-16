import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let page: typeof import("~/routes/admin._index");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  page = await import("~/routes/admin._index");
});

let n = 0;
async function mk(role: "teacher" | "admin") {
  n++;
  const u = await users.createUser({
    name: `O ${n}`,
    email: `o${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
  return { id: u.id, role };
}

const load = () =>
  page.loader({
    request: signedRequest("http://localhost/admin"),
    params: {},
    context: {},
  } as never) as Promise<Awaited<ReturnType<typeof page.loader>>>;

const done = async () =>
  Object.fromEntries((await load()).steps.map((s) => [s.id, s.done])) as Record<string, boolean>;

let admin: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  admin ??= await mk("admin");
  await signInAs({ id: admin.id });
});

describe("/admin (Beheer → Overzicht en inrichten)", () => {
  it("is for admins only", async () => {
    const teacher = await mk("teacher");
    await signInAs({ id: teacher.id });
    await expect(load()).rejects.toBeInstanceOf(Response);
  });

  it("is a page now, no longer a redirect to Gebruikers", async () => {
    const data = await load();
    expect(data.steps.map((s) => s.id)).toEqual([
      "kind",
      "divisions",
      "programmes",
      "people",
      "teams",
      "link",
    ]);
  });

  it("reads the steps from the institution: people invited, teams with members", async () => {
    expect((await done()).people).toBe(true); // the teacher above
    expect((await load()).counts.users).toBeGreaterThanOrEqual(2);
    const team = await teams.createTeam("Team Informatica");
    expect((await done()).teams).toBe(false);
    await teams.addMember(team.id, admin.id);
    expect((await done()).teams).toBe(true);
  });

  it("counts linking done once every programme has a team", async () => {
    const programmes = await import("~/server/repositories/programmes.server");
    const links = await import("~/server/repositories/programmeTeams.server");
    const actor = { id: admin.id, role: "admin" };
    const team = await teams.createTeam("Team Link");
    await teams.addMember(team.id, admin.id);
    const p = (await programmes.createProgramme(actor, null, { name: "Los", sector: "hbo" }))!;
    expect((await done()).link).toBe(false);
    await links.linkProgrammeTeam(actor, p.id, team.id);
    expect((await done()).link).toBe(true);
  });
});
