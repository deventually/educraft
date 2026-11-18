/**
 * The default model in layers (BESLUIT-2026-11-18-4): a teacher's own default, else their
 * team's, else the institution's, else `default` in config/models.json. A layer counts only
 * when its model is open to that person; otherwise the next one decides.
 */
import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

type Availability = typeof import("~/server/availability.server");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");
type Teams = typeof import("~/server/repositories/teams.server");

let availability: Availability;
let settings: Settings;
let users: Users;
let teams: Teams;
let DEFAULT_MODEL: string;
// Three selectable catalog models other than the config default.
let a: string;
let b: string;
let c: string;

const admin = { id: "dm-admin", role: "admin" as const };

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  settings = await import("~/server/repositories/settings.server");
  users = await import("~/server/repositories/users.server");
  teams = await import("~/server/repositories/teams.server");
  ({ DEFAULT_MODEL } = await import("~/lib/ai/models"));
  const ids = [...(await availability.getSelectableModelIds())].filter(
    (id) => id !== DEFAULT_MODEL,
  );
  [a, b, c] = ids as [string, string, string];
});

async function teacher(email: string) {
  const u = await users.createUser({ name: email, email, passwordHash: "x", role: "teacher" });
  return { id: u.id, role: "teacher" as const };
}

async function teamWithDefault(name: string, member: string, defaultModel: string | null) {
  const team = await teams.createTeam(name);
  await teams.addMember(team.id, member);
  await teams.setTeamSettings(team.id, { features: {}, tools: {}, models: null, defaultModel });
  return team;
}

describe("the institution's default model", () => {
  it("is unset on a fresh instance: the config default serves", async () => {
    expect(await settings.getDefaultModel()).toBeNull();
    expect(await availability.effectiveDefaultModel(admin, DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
  });

  it("replaces the config default for everyone, and clearing it brings that back", async () => {
    await settings.setDefaultModel(a);
    expect(await settings.getDefaultModel()).toBe(a);
    expect(await availability.effectiveDefaultModel(admin, DEFAULT_MODEL)).toBe(a);
    const t = await teacher("dm-inst@example.com");
    expect(await availability.servedModelFor(t, undefined, DEFAULT_MODEL)).toBe(a);
    await settings.setDefaultModel(null);
    expect(await availability.effectiveDefaultModel(admin, DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
  });

  it("is skipped when the institution switched that model off", async () => {
    await settings.setDefaultModel(a);
    await settings.setEnabledModels([DEFAULT_MODEL, b]);
    expect(await availability.effectiveDefaultModel(admin, DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
    await settings.setEnabledModels(null);
    await settings.setDefaultModel(null);
  });
});

describe("a team's default model", () => {
  it("beats the institution's for its members only", async () => {
    await settings.setDefaultModel(a);
    const member = await teacher("dm-team@example.com");
    const outsider = await teacher("dm-outside@example.com");
    await teamWithDefault("DM Wiskunde", member.id, b);
    expect(await availability.effectiveDefaultModel(member, DEFAULT_MODEL)).toBe(b);
    expect(await availability.effectiveDefaultModel(outsider, DEFAULT_MODEL)).toBe(a);
    await settings.setDefaultModel(null);
  });

  it("with several teams, the first team by name that has one decides", async () => {
    const t = await teacher("dm-two@example.com");
    await teamWithDefault("DM Zang", t.id, c);
    await teamWithDefault("DM Biologie", t.id, b);
    await teamWithDefault("DM Aardrijkskunde", t.id, null);
    expect(await availability.effectiveDefaultModel(t, DEFAULT_MODEL)).toBe(b);
  });

  it("is skipped when the team's own model set leaves it out", async () => {
    const t = await teacher("dm-narrow@example.com");
    const team = await teams.createTeam("DM Smal");
    await teams.addMember(team.id, t.id);
    await teams.setTeamSettings(team.id, { features: {}, tools: {}, models: [c], defaultModel: b });
    expect(await availability.effectiveDefaultModel(t, DEFAULT_MODEL)).toBe(c);
  });
});

describe("a teacher's own default model", () => {
  it("beats team and institution, and clearing it hands back to them", async () => {
    await settings.setDefaultModel(a);
    const t = await teacher("dm-own@example.com");
    await teamWithDefault("DM Eigen", t.id, b);
    await users.setUserDefaultModel(t.id, c);
    expect(await users.getUserDefaultModel(t.id)).toBe(c);
    expect(await availability.effectiveDefaultModel(t, DEFAULT_MODEL)).toBe(c);
    await users.setUserDefaultModel(t.id, null);
    expect(await users.getUserDefaultModel(t.id)).toBeNull();
    expect(await availability.effectiveDefaultModel(t, DEFAULT_MODEL)).toBe(b);
    await settings.setDefaultModel(null);
  });

  it("is skipped when the teacher may not use that model", async () => {
    const t = await teacher("dm-blocked@example.com");
    await users.setUserAssignedModels(t.id, [b]);
    await users.setUserDefaultModel(t.id, a);
    expect(await availability.effectiveDefaultModel(t, DEFAULT_MODEL)).toBe(b);
  });

  it("never outranks a model the request asks for", async () => {
    const t = await teacher("dm-asked@example.com");
    await users.setUserDefaultModel(t.id, c);
    expect(await availability.servedModelFor(t, b, DEFAULT_MODEL)).toBe(b);
    expect(await availability.servedModelFor(t, undefined, DEFAULT_MODEL)).toBe(c);
  });

  it("is removed with the account", async () => {
    const t = await teacher("dm-gone@example.com");
    await users.setUserDefaultModel(t.id, c);
    await users.deleteUserCascade(t.id);
    expect(await users.getUserDefaultModel(t.id)).toBeNull();
  });
});
