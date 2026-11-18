/**
 * Expensive models per team or teacher (BESLUIT-2026-11-18-5): a model teachers may not pick
 * themselves (not client-selectable, like Opus) is never in the institution's list, but the
 * admin can switch it on for one team or one teacher. Then it is theirs to pick, also as
 * their default; for everyone else it stays out.
 */
import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

type Availability = typeof import("~/server/availability.server");
type Users = typeof import("~/server/repositories/users.server");
type Teams = typeof import("~/server/repositories/teams.server");

let availability: Availability;
let users: Users;
let teams: Teams;
let OPUS: string;

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  const { listModels, modelState } = await import("~/lib/ai/models");
  OPUS = listModels().find(
    (m) => !m.clientSelectable && !m.local && modelState(m.id) === "active",
  )!.id;
});

async function teacher(email: string) {
  const u = await users.createUser({ name: email, email, passwordHash: "x", role: "teacher" });
  return { id: u.id, role: "teacher" as const };
}

describe("an expensive model switched on for one teacher", () => {
  it("is selectable, offered in the picker and can be their default; not for others", async () => {
    const t = await teacher("em-own@example.com");
    const other = await teacher("em-other@example.com");
    expect(await availability.isModelSelectableForUser(t, OPUS)).toBe(false);
    await users.setUserExtraModels(t.id, [OPUS]);
    expect(await users.getUserExtraModels(t.id)).toEqual([OPUS]);
    expect(await availability.isModelSelectableForUser(t, OPUS)).toBe(true);
    expect((await availability.getSelectableModels(t)).map((m) => m.id)).toContain(OPUS);
    // Next to the models they had: it adds, it does not replace.
    expect((await availability.getSelectableModelIds(t)).size).toBeGreaterThan(1);
    await users.setUserDefaultModel(t.id, OPUS);
    expect(await availability.effectiveDefaultModel(t, OPUS)).toBe(OPUS);
    expect(await availability.servedModelFor(t, OPUS, OPUS)).toBe(OPUS);
    expect(await availability.isModelSelectableForUser(other, OPUS)).toBe(false);
    expect(await availability.servedModelFor(other, OPUS, OPUS)).not.toBe(OPUS);
  });

  it("is gone again when the admin switches it off, and with the account", async () => {
    const t = await teacher("em-off@example.com");
    await users.setUserExtraModels(t.id, [OPUS]);
    await users.setUserExtraModels(t.id, null);
    expect(await availability.isModelSelectableForUser(t, OPUS)).toBe(false);
    await users.setUserExtraModels(t.id, [OPUS]);
    await users.deleteUserCascade(t.id);
    expect(await users.getUserExtraModels(t.id)).toBeNull();
  });

  it("never makes an ordinary model selectable that the institution switched off", async () => {
    const settings = await import("~/server/repositories/settings.server");
    const t = await teacher("em-ordinary@example.com");
    const [a, b] = [...(await availability.getSelectableModelIds())];
    await settings.setEnabledModels([a!]);
    await users.setUserExtraModels(t.id, [b!]);
    expect(await availability.isModelSelectableForUser(t, b!)).toBe(false);
    await settings.setEnabledModels(null);
  });
});

describe("an expensive model switched on for a team", () => {
  it("is selectable for its members only", async () => {
    const member = await teacher("em-team@example.com");
    const outsider = await teacher("em-outsider@example.com");
    const team = await teams.createTeam("EM Team");
    await teams.addMember(team.id, member.id);
    await teams.setTeamSettings(team.id, {
      features: {},
      tools: {},
      models: null,
      extraModels: [OPUS],
    });
    expect(await availability.isModelSelectableForUser(member, OPUS)).toBe(true);
    expect(await availability.isModelSelectableForUser(outsider, OPUS)).toBe(false);
  });

  it("does not count for an admin's own requests", async () => {
    const admin = { id: "em-admin", role: "admin" as const };
    await users.setUserExtraModels(admin.id, [OPUS]);
    expect(await availability.isModelSelectableForUser(admin, OPUS)).toBe(false);
  });
});
