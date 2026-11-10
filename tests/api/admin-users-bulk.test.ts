import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let list: typeof import("~/routes/admin.users");

beforeAll(async () => {
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  list = await import("~/routes/admin.users");
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
const as = (u: { id: string }) => signInAs({ id: u.id });

let admin: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  admin ??= await mk("Admin", "admin");
  await as(admin);
});

function post(fields: Record<string, string | string[]>, path = "/x"): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields))
    for (const value of Array.isArray(v) ? v : [v]) body.append(k, value);
  return signedRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}
const call = <F extends (a: never) => unknown>(fn: F, args: object) =>
  fn({ params: {}, context: {}, ...args } as never) as Promise<Awaited<ReturnType<F>>>;
const memberIds = async (teamId: string) =>
  ((await teams.getTeamWithMembers(teamId))?.members ?? []).map((m) => m.userId);

const bulk = (fields: Record<string, string | string[]>) =>
  call(list.action, { request: post({ intent: "bulk", ...fields }) }) as Promise<{
    bulk?: { done: number; skipped: number };
    error?: string;
  }>;

describe("/admin/users: change many people at once", () => {
  it("puts the ticked people in a team, and takes them out again", async () => {
    await settings.setOwnerUserId(null);
    const team = await teams.createTeam("Bulk team");
    const a = await mk("Bulk A");
    const b = await mk("Bulk B");
    expect(await bulk({ action: "addTeam", teamId: team.id, userIds: [a.id, b.id] })).toEqual({
      bulk: { done: 2, skipped: 0 },
    });
    expect((await memberIds(team.id)).sort()).toEqual([a.id, b.id].sort());
    expect(await bulk({ action: "removeTeam", teamId: team.id, userIds: [a.id] })).toEqual({
      bulk: { done: 1, skipped: 0 },
    });
    expect(await memberIds(team.id)).toEqual([b.id]);
  });

  it("a regular admin skips another admin, and an unknown id", async () => {
    await settings.setOwnerUserId(null);
    const team = await teams.createTeam("Bulk rechten");
    const t = await mk("Bulk Docent");
    const other = await mk("Bulk Beheerder", "admin");
    expect(
      await bulk({ action: "addTeam", teamId: team.id, userIds: [t.id, other.id, "ghost"] }),
    ).toEqual({ bulk: { done: 1, skipped: 2 } });
    expect(await memberIds(team.id)).toEqual([t.id]);
  });

  it("deactivates and reactivates (owner only), never the owner themself", async () => {
    await settings.setOwnerUserId(admin.id);
    const a = await mk("Bulk Uit A");
    const b = await mk("Bulk Uit B");
    expect(await bulk({ action: "deactivate", userIds: [a.id, b.id, admin.id] })).toEqual({
      bulk: { done: 2, skipped: 1 },
    });
    expect((await users.getUserById(a.id))?.disabledAt).toBeTruthy();
    expect((await users.getUserById(admin.id))?.disabledAt).toBeFalsy();
    expect(await bulk({ action: "reactivate", userIds: [a.id] })).toEqual({
      bulk: { done: 1, skipped: 0 },
    });
    expect((await users.getUserById(a.id))?.disabledAt).toBeFalsy();
    await settings.setOwnerUserId(null);
  });

  it("refuses deactivation for a regular admin, before touching anyone", async () => {
    await settings.setOwnerUserId(null);
    const a = await mk("Bulk Niet Uit");
    expect(await bulk({ action: "deactivate", userIds: [a.id] })).toEqual({ error: "ownerOnly" });
    expect((await users.getUserById(a.id))?.disabledAt).toBeFalsy();
  });

  it("refuses nothing ticked, an unknown team and an unknown action", async () => {
    const a = await mk("Bulk Leeg");
    expect(await bulk({ action: "addTeam", teamId: "x" })).toEqual({ error: "noneSelected" });
    expect(await bulk({ action: "addTeam", teamId: "nope", userIds: [a.id] })).toEqual({
      error: "teamRequired",
    });
    expect(await bulk({ action: "explode", userIds: [a.id] })).toEqual({ error: "unknown" });
  });
});
