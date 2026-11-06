import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";
vi.mock("~/server/log.server", () => ({ log: vi.fn() }));

type Availability = typeof import("~/server/availability.server");
type Store = typeof import("~/server/modelRegistry.server");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");
type Reg = typeof import("~/lib/ai/modelRegistry");

let availability: Availability;
let store: Store;
let settings: Settings;
let users: Users;
let reg: Reg;

const admin = { id: "admin-1", role: "admin" as const };
const OLD = "claude-haiku-4-5";
const NEW = "anthropic/claude-haiku-5-5";

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  store = await import("~/server/modelRegistry.server");
  settings = await import("~/server/repositories/settings.server");
  users = await import("~/server/repositories/users.server");
  reg = await import("~/lib/ai/modelRegistry");
});

afterEach(async () => {
  await store.saveModelRegistry(reg.EMPTY_REGISTRY);
  await settings.setEnabledModels(null);
});

/** Add Haiku 5.5 and, when asked, start (or finish) the upgrade from Haiku 4.5. */
async function setup(step: "added" | "retiring" | "retired") {
  const added = reg.addModel(reg.EMPTY_REGISTRY, {
    provider: "anthropic",
    apiId: "claude-haiku-5-5",
    displayName: "Claude Haiku 5.5",
    supportsImages: true,
    alwaysThinks: true,
    clientSelectable: true,
  });
  if (!added.ok) throw new Error(added.error);
  let registry = added.registry;
  if (step !== "added") {
    const up = reg.startUpgrade(registry, OLD, NEW);
    if (!up.ok) throw new Error(up.error);
    registry = up.registry;
  }
  if (step === "retired") {
    const done = reg.finishUpgrade(registry, OLD);
    if (!done.ok) throw new Error(done.error);
    registry = done.registry;
  }
  await store.saveModelRegistry(registry);
}

describe("an added model joins the gates like a catalog model", () => {
  it("is stored and read back from the database", async () => {
    await setup("added");
    expect((await store.getModelRegistry()).added.map((m) => m.id)).toEqual([NEW]);
  });

  it("is offered in the picker of an uncurated instance", async () => {
    await setup("added");
    const ids = (await availability.getSelectableModels(admin)).map((m) => m.id);
    expect(ids).toContain(NEW);
    expect(await availability.isModelSelectableForUser(admin, NEW)).toBe(true);
  });
});

describe("upgrading: new work goes to the new version, running work may finish", () => {
  it("the picker offers the new version instead of the old one", async () => {
    await setup("retiring");
    const ids = (await availability.getSelectableModels(admin)).map((m) => m.id);
    expect(ids).toContain(NEW);
    expect(ids).not.toContain(OLD);
  });

  it("an allow-list or a teacher's own set naming the old version now offers the new one", async () => {
    await setup("retiring");
    await settings.setEnabledModels([OLD]);
    expect([...(await availability.getSelectableModelIds(admin))]).toEqual([NEW]);
    const teacher = await users.createUser({
      name: "Upgrade Teacher",
      email: "upgrade-teacher@example.com",
      passwordHash: "x",
      role: "teacher",
    });
    await users.setUserAssignedModels(teacher.id, [OLD]);
    const t = { id: teacher.id, role: "teacher" as const };
    expect([...(await availability.getSelectableModelIds(t))]).toEqual([NEW]);
  });

  it("a conversation that still names the old version may finish on it", async () => {
    await setup("retiring");
    expect(await availability.isModelSelectableForUser(admin, OLD)).toBe(true);
  });

  it("a tool default naming the old version serves the new one", async () => {
    await setup("retiring");
    expect(await availability.effectiveDefaultModel(admin, OLD)).toBe(NEW);
  });
});

describe("retired: the old version is never served again", () => {
  it("a request naming the old version is not selectable as such", async () => {
    await setup("retired");
    expect(await availability.isModelSelectableForUser(admin, OLD)).toBe(false);
  });

  it("the served model for a request naming the old version is the new one", async () => {
    await setup("retired");
    expect(await availability.servedModelFor(admin, OLD, OLD)).toBe(NEW);
  });
});
