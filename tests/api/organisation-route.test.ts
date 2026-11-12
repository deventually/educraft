import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let teams: typeof import("~/server/repositories/teams.server");
let programmes: typeof import("~/server/repositories/programmes.server");
let org: typeof import("~/server/repositories/organisation.server");
let page: typeof import("~/routes/admin.organisation");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  programmes = await import("~/server/repositories/programmes.server");
  org = await import("~/server/repositories/organisation.server");
  page = await import("~/routes/admin.organisation");
});

let n = 0;
async function mk(role: "teacher" | "admin") {
  n++;
  const u = await users.createUser({
    name: `P ${n}`,
    email: `p${n}@school.nl`,
    passwordHash: "scrypt:a:b",
    role,
  });
  return { id: u.id, role };
}

function post(fields: Record<string, string>): Request {
  return signedRequest("http://localhost/admin/organisation", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
const get = () => signedRequest("http://localhost/admin/organisation");
const call = <F extends (a: never) => unknown>(fn: F, args: object) =>
  fn({ params: {}, context: {}, ...args } as never) as Promise<Awaited<ReturnType<F>>>;
async function refused(p: Promise<unknown>): Promise<boolean> {
  try {
    await p;
    return false;
  } catch (e) {
    return e instanceof Response;
  }
}

let admin: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  admin ??= await mk("admin");
  await signInAs({ id: admin.id });
});

describe("/admin/organisation (Beheer → Organisatie)", () => {
  it("is for admins only, loader and action", async () => {
    const teacher = await mk("teacher");
    await signInAs({ id: teacher.id });
    expect(await refused(call(page.loader, { request: get() }))).toBe(true);
    expect(
      await refused(call(page.action, { request: post({ intent: "create", name: "X" }) })),
    ).toBe(true);
  });

  it("chooses what the layer is called", async () => {
    const res = await call(page.action, { request: post({ intent: "kind", kind: "location" }) });
    expect(res).toEqual({ ok: "kind" });
    expect((await call(page.loader, { request: get() })).kind).toBe("location");
    expect(await call(page.action, { request: post({ intent: "kind", kind: "x" }) })).toEqual({
      error: "invalid",
    });
  });

  it("creates, renames and deletes a division", async () => {
    expect(await call(page.action, { request: post({ intent: "create", name: "Noord" }) })).toEqual(
      { ok: "create" },
    );
    const d = (await call(page.loader, { request: get() })).divisions.find(
      (x) => x.name === "Noord",
    )!;
    expect(
      await call(page.action, { request: post({ intent: "rename", id: d.id, name: "Zuid" }) }),
    ).toEqual({ ok: "rename" });
    expect(await call(page.action, { request: post({ intent: "delete", id: d.id }) })).toEqual({
      ok: "delete",
    });
    const names = (await call(page.loader, { request: get() })).divisions.map((x) => x.name);
    expect(names).not.toContain("Zuid");
  });

  it("refuses an empty name and deleting a division with programmes", async () => {
    expect(await call(page.action, { request: post({ intent: "create", name: " " }) })).toEqual({
      error: "name",
    });
    const d = await org.createDivision(admin, "Vol");
    const team = await teams.createTeam("Team org");
    const p = await programmes.createProgramme(admin, team.id, { name: "Pabo", sector: "hbo" });
    await org.setProgrammeDivision(admin, p!.id, d!.id);
    expect(await call(page.action, { request: post({ intent: "delete", id: d!.id }) })).toEqual({
      error: "notEmpty",
    });
  });

  it("moves a programme to a division and back to none, and lists it with its team", async () => {
    const d = await org.createDivision(admin, "Faculteit Zorg");
    const team = await teams.createTeam("Team VPK");
    const p = await programmes.createProgramme(admin, team.id, {
      name: "Verpleegkunde",
      sector: "hbo",
    });
    expect(
      await call(page.action, {
        request: post({ intent: "move", programmeId: p!.id, divisionId: d!.id }),
      }),
    ).toEqual({ ok: "move" });
    const data = await call(page.loader, { request: get() });
    const row = data.programmes.find((x) => x.id === p!.id)!;
    expect(row).toMatchObject({ name: "Verpleegkunde", teamName: "Team VPK", divisionId: d!.id });
    expect(
      await call(page.action, {
        request: post({ intent: "move", programmeId: p!.id, divisionId: "" }),
      }),
    ).toEqual({ ok: "move" });
    expect((await programmes.getProgramme(admin, p!.id))?.divisionId).toBeNull();
  });
});
