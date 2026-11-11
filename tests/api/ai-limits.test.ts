import { beforeAll, describe, expect, it } from "vitest";

let limits: typeof import("~/server/aiLimits.server");
let admin: typeof import("~/server/aiLimitsAdmin.server");
let repo: typeof import("~/server/repositories/aiLimits.server");
let usage: typeof import("~/server/repositories/aiUsage.server");
let audit: typeof import("~/server/repositories/auditLog.server");
let teamId = "";
const today = new Date().toISOString().slice(0, 10);

const teacher = (id: string) => ({ id, role: "teacher" as const });
const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};
const actor = (id: string) => ({
  id,
  role: "admin" as const,
  name: id,
  email: null,
  createdAt: new Date(0),
});

beforeAll(async () => {
  limits = await import("~/server/aiLimits.server");
  admin = await import("~/server/aiLimitsAdmin.server");
  repo = await import("~/server/repositories/aiLimits.server");
  usage = await import("~/server/repositories/aiUsage.server");
  audit = await import("~/server/repositories/auditLog.server");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  const settings = await import("~/server/repositories/settings.server");
  for (const id of ["lim-a", "lim-b", "lim-solo"]) {
    await users.createUser({ id, name: `Naam ${id}`, passwordHash: "scrypt:x:y", role: "teacher" });
  }
  for (const id of ["lim-owner", "lim-admin"]) {
    await users.createUser({ id, name: id, passwordHash: "scrypt:x:y", role: "admin" });
  }
  await settings.setOwnerUserId("lim-owner");
  teamId = (await teams.createTeam("Limiet team")).id;
  await teams.addMember(teamId, "lim-a");
  await teams.addMember(teamId, "lim-b");
  const spend = (id: string, micros: number) =>
    usage.recordAiUsage(id, { source: "x", model: "m", costMicros: micros }, today);
  await spend("lim-a", 3_000_000);
  await spend("lim-b", 6_000_000);
});

describe("aiLimitFor", () => {
  it("is null for an admin and for a teacher without any limit", async () => {
    expect(await limits.aiLimitFor({ id: "lim-admin", role: "admin" })).toBeNull();
    expect(await limits.aiLimitFor(teacher("lim-solo"))).toBeNull();
  });

  it("counts the whole team against a team limit, and names the team", async () => {
    await repo.setAiLimit({ kind: "team", id: teamId }, 10);
    // 3 + 6 = 9 of 10 euro.
    expect(await limits.aiLimitFor(teacher("lim-a"))).toMatchObject({
      scope: "team",
      teamName: "Limiet team",
      state: "warn",
    });
    expect(await limits.aiGate(teacher("lim-a"))).toBeNull();
  });

  it("lets a teacher's own limit replace the team's", async () => {
    await repo.setAiLimit({ kind: "user", id: "lim-a" }, 3);
    expect(await limits.aiLimitFor(teacher("lim-a"))).toMatchObject({
      scope: "user",
      state: "stop",
    });
    expect(await limits.aiGate(teacher("lim-a"))).toBe("limit");
    await repo.setAiLimit({ kind: "user", id: "lim-a" }, null);
    await repo.setAiLimit({ kind: "team", id: teamId }, null);
  });
});

describe("setLimitFromForm", () => {
  it("lets only the owner set the budget, and logs it", async () => {
    const fd = form({ intent: "budget", euros: "250" });
    expect(await admin.setLimitFromForm(actor("lim-admin"), fd)).toEqual({ error: "ownerOnly" });
    expect(await admin.setLimitFromForm(actor("lim-owner"), fd)).toEqual({
      limitSaved: { name: null, cleared: false },
    });
    expect((await repo.getAiLimits()).budget).toBe(250);
    const [last] = await audit.listAdminActions(1);
    expect(last).toMatchObject({
      action: "aiLimitChanged",
      detail: { limit: { kind: "budget", euros: 250 } },
    });
    await admin.setLimitFromForm(actor("lim-owner"), form({ intent: "budget", euros: "" }));
    expect((await repo.getAiLimits()).budget).toBeUndefined();
  });

  it("lets an admin set a team's and a teacher's limit, never an admin's", async () => {
    const a = actor("lim-admin");
    expect(
      await admin.setLimitFromForm(a, form({ intent: "teamLimit", id: teamId, euros: "40" })),
    ).toEqual({ limitSaved: { name: "Limiet team", cleared: false } });
    expect(
      await admin.setLimitFromForm(a, form({ intent: "userLimit", id: "lim-b", euros: "12,50" })),
    ).toEqual({ limitSaved: { name: "Naam lim-b", cleared: false } });
    expect(await repo.getAiLimits()).toMatchObject({
      teams: { [teamId]: 40 },
      users: { "lim-b": 12.5 },
    });
    expect(
      await admin.setLimitFromForm(a, form({ intent: "userLimit", id: "lim-owner", euros: "5" })),
    ).toEqual({ error: "unknown" });
    expect(
      await admin.setLimitFromForm(a, form({ intent: "teamLimit", id: "nope", euros: "5" })),
    ).toEqual({ error: "unknown" });
    expect(
      await admin.setLimitFromForm(a, form({ intent: "teamLimit", id: teamId, euros: "veel" })),
    ).toEqual({ error: "amount" });
  });

  it("ignores other intents", async () => {
    expect(await admin.setLimitFromForm(actor("lim-admin"), form({ intent: "x" }))).toBeNull();
  });
});
