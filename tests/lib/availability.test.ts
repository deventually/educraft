import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module (and thus env.server) loads.
process.env.DATABASE_URL = "file::memory:";

// Capture the structured warning emitted when an admin's model allow-list would
// otherwise select nothing (the guard against locking everyone out).
const { logMock } = vi.hoisted(() => ({ logMock: vi.fn() }));
vi.mock("~/server/log.server", () => ({ log: logMock }));

type Availability = typeof import("~/server/availability.server");
type Settings = typeof import("~/server/repositories/settings.server");
type Users = typeof import("~/server/repositories/users.server");
type Registry = typeof import("~/lib/registry");

let availability: Availability;
let settings: Settings;
let users: Users;
let registry: Registry;

const admin = { id: "admin-1", role: "admin" as const };

// Disjoint fixtures per concern so tests stay order-independent.
const STUDENT_TOOL = "mentorai"; // untouched → registry default
const INSTRUCTOR_TOOL = "bloom-by-design"; // untouched → registry default
const DISABLED_TOOL = "arcs-reactor"; // this file disables it

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  settings = await import("~/server/repositories/settings.server");
  users = await import("~/server/repositories/users.server");
  registry = await import("~/lib/registry");
});

describe("getAvailableTools — registry defaults (empty settings)", () => {
  it("an admin sees registry-enabled tools of both audiences", async () => {
    const slugs = (await availability.getAvailableTools(admin)).map((t) => t.slug);
    expect(slugs).toContain(STUDENT_TOOL);
    expect(slugs).toContain(INSTRUCTOR_TOOL);
  });

  it("a teacher sees tools of both audiences too (no audience gate)", async () => {
    const slugs = (await availability.getAvailableTools({ id: "t-open", role: "teacher" })).map(
      (t) => t.slug,
    );
    expect(slugs).toContain(STUDENT_TOOL);
    expect(slugs).toContain(INSTRUCTOR_TOOL);
  });
});

describe("getAvailableTools — instance overrides", () => {
  it("a disabled tool disappears for everyone, including admins", async () => {
    await settings.setToolSetting(DISABLED_TOOL, { enabled: false });
    const forAdmin = (await availability.getAvailableTools(admin)).map((t) => t.slug);
    expect(forAdmin).not.toContain(DISABLED_TOOL);
    // And the single-tool gate agrees (drives tool.tsx 404 + api.stream refusal).
    const tool = registry.getToolBySlug(DISABLED_TOOL);
    expect(await availability.isToolAvailable(admin, tool!)).toBe(false);
  });
});

describe("getAvailableTools — no per-teacher gate (P18.2)", () => {
  it("a teacher sees every instance-enabled tool; a stored allow-list is ignored", async () => {
    const legacy = await users.createUser({
      name: "Legacy",
      email: "legacy@example.com",
      passwordHash: "x",
      role: "teacher",
    });
    // The column survives until 18.8; set it directly (the setter is gone).
    const { getDb } = await import("~/server/db.server");
    const { users: usersTable } = await import("~/server/schema.server");
    const { eq } = await import("drizzle-orm");
    await getDb()
      .update(usersTable)
      .set({ allowedToolSlugs: JSON.stringify([STUDENT_TOOL]) })
      .where(eq(usersTable.id, legacy.id));

    const slugs = (await availability.getAvailableTools({ id: legacy.id, role: "teacher" })).map(
      (t) => t.slug,
    );
    expect(slugs).toContain(STUDENT_TOOL);
    expect(slugs).toContain(INSTRUCTOR_TOOL);
  });
});

describe("getSelectableModels — admin model allow-list + lockout guard", () => {
  it("defaults to the client-selectable catalog (never Opus)", async () => {
    const ids = await availability.getSelectableModelIds();
    expect(ids.has("claude-sonnet-4-6")).toBe(true);
    expect(ids.has("claude-haiku-4-5")).toBe(true);
    expect(ids.has("claude-opus-4-8")).toBe(false); // not client-selectable
  });

  it("honors an explicit allow-list", async () => {
    await settings.setEnabledModels(["claude-haiku-4-5"]);
    const ids = await availability.getSelectableModelIds();
    expect([...ids]).toEqual(["claude-haiku-4-5"]);
    await settings.setEnabledModels(null); // reset
  });

  it("falls back to the default model (and warns) when the intersection is empty", async () => {
    logMock.mockClear();
    await settings.setEnabledModels(["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds();
    expect([...ids]).toEqual(["claude-sonnet-5-5"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await settings.setEnabledModels(null); // reset
  });
});

describe("getSelectableModelIds — per-teacher narrowing (P13)", () => {
  const teacher = { id: "mdl-teacher", role: "teacher" as const };

  it("no user (admin) is unchanged: the instance base, never widened", async () => {
    const ids = await availability.getSelectableModelIds();
    const forAdmin = await availability.getSelectableModelIds(admin);
    expect(forAdmin.has("claude-sonnet-4-6")).toBe(true);
    expect(forAdmin.has("claude-haiku-4-5")).toBe(true);
    // Admin follows the instance base exactly (no per-teacher path).
    expect([...forAdmin].sort()).toEqual([...ids].sort());
  });

  it("a teacher's assignment narrows the base (intersect); clearing restores it", async () => {
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const narrowed = await availability.getSelectableModelIds(teacher);
    expect(narrowed.has("claude-haiku-4-5")).toBe(true);
    expect(narrowed.has("claude-sonnet-4-6")).toBe(false);

    await users.setUserAssignedModels(teacher.id, null);
    const inherited = await availability.getSelectableModelIds(teacher);
    expect(inherited.has("claude-sonnet-4-6")).toBe(true); // back to base
  });

  it("getSelectableModels mirrors the narrowing for the picker", async () => {
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const models = await availability.getSelectableModels(teacher);
    expect(models.map((m) => m.id)).toEqual(["claude-haiku-4-5"]);
    await users.setUserAssignedModels(teacher.id, null); // reset
  });

  it("an out-of-base teacher assignment falls back to the default (+warns), never empty", async () => {
    logMock.mockClear();
    await users.setUserAssignedModels(teacher.id, ["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds(teacher);
    expect([...ids]).toEqual(["claude-sonnet-5-5"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await users.setUserAssignedModels(teacher.id, null); // reset
  });
});

describe("isModelSelectableForUser — local/CLI join the gate (P14)", () => {
  const teacher = { id: "p14-teacher", role: "teacher" as const };
  const CLI = "claude-code"; // static local CLI agent (clientSelectable)
  const LOCAL = "ollama::p14-model"; // discovered local id (resolves via parseDynamicModel)

  it("an uncurated instance selects a CLI agent and a discovered local model", async () => {
    expect(await availability.isModelSelectableForUser(undefined, CLI)).toBe(true);
    expect(await availability.isModelSelectableForUser(undefined, LOCAL)).toBe(true);
    // frontier still selectable; Opus and unknown ids never
    expect(await availability.isModelSelectableForUser(undefined, "claude-sonnet-4-6")).toBe(true);
    expect(await availability.isModelSelectableForUser(undefined, "claude-opus-4-8")).toBe(false);
    expect(await availability.isModelSelectableForUser(undefined, "no-such-id")).toBe(false);
  });

  it("an explicit instance allow-list omitting the CLI id blocks it (curation)", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]); // CLI not listed
    expect(await availability.isModelSelectableForUser(undefined, CLI)).toBe(false);
    expect(await availability.isModelSelectableForUser(undefined, LOCAL)).toBe(false);
    // once listed, it is selectable again
    await settings.setEnabledModels(["claude-sonnet-4-6", CLI]);
    expect(await availability.isModelSelectableForUser(undefined, CLI)).toBe(true);
    await settings.setEnabledModels(null); // reset
  });

  it("a teacher assignment narrows a local/CLI id (intersect); clearing restores it", async () => {
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]); // no CLI
    expect(await availability.isModelSelectableForUser(teacher, CLI)).toBe(false);
    await users.setUserAssignedModels(teacher.id, null);
    expect(await availability.isModelSelectableForUser(teacher, CLI)).toBe(true);
  });

  it("narrowLocalModels drops discovered models outside the effective set", async () => {
    const discovered = [
      { id: "ollama::a", displayName: "ollama::a" },
      { id: "ollama::b", displayName: "ollama::b" },
    ];
    // uncurated → both kept
    expect((await availability.narrowLocalModels(undefined, discovered)).map((m) => m.id)).toEqual([
      "ollama::a",
      "ollama::b",
    ]);
    // curated to only ollama::a → drops ollama::b
    await settings.setEnabledModels(["ollama::a"]);
    expect((await availability.narrowLocalModels(undefined, discovered)).map((m) => m.id)).toEqual([
      "ollama::a",
    ]);
    await settings.setEnabledModels(null); // reset
  });
});

// A teacher whose ONLY allowed model is a discovered local one
// ("ollama::…"). Such an id is never in the static catalog, so the catalog
// INTERSECT collapses to empty — but the caller is NOT locked out (the model
// rides `narrowLocalModels`). The old lockout guard mistook this for a misconfig
// and re-offered DEFAULT_MODEL (a disabled frontier default). These pin the fix.
describe("model gates — a local-only allow-list is not a lockout (bugfix)", () => {
  const LOCAL = "ollama::qwen3.6:27b-coding-nvfp4";

  async function localOnlyTeacher(id: string) {
    const teacher = { id, role: "teacher" as const };
    // Sonnet & the rest of the catalog excluded.
    await users.setUserAssignedModels(id, [LOCAL]);
    return teacher;
  }

  it("getSelectableModelIds returns an empty CATALOG set — never DEFAULT_MODEL — and does not warn", async () => {
    logMock.mockClear();
    const teacher = await localOnlyTeacher("local-only-catalog");
    const ids = await availability.getSelectableModelIds(teacher);
    // The catalog half is legitimately empty; the local model rides narrowLocalModels.
    expect([...ids]).toEqual([]);
    expect(ids.has("claude-sonnet-4-6")).toBe(false);
    // Not a lockout → the availability warning must NOT fire.
    expect(logMock).not.toHaveBeenCalled();
  });

  it("still rescues a GENUINE lockout (an allow-list of only unknown catalog ids) with DEFAULT_MODEL", async () => {
    logMock.mockClear();
    await users.setUserAssignedModels("bug-genuine-teacher", ["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds({
      id: "bug-genuine-teacher",
      role: "teacher",
    });
    expect([...ids]).toEqual(["claude-sonnet-5-5"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await users.setUserAssignedModels("bug-genuine-teacher", null); // reset
  });

  it("effectiveDefaultModel keeps the preferred default for an unrestricted caller", async () => {
    expect(await availability.effectiveDefaultModel(admin, "claude-sonnet-4-6")).toBe(
      "claude-sonnet-4-6",
    );
    expect(
      await availability.effectiveDefaultModel(
        { id: "edm-free-teacher", role: "teacher" },
        "claude-sonnet-4-6",
      ),
    ).toBe("claude-sonnet-4-6");
  });

  it("effectiveDefaultModel substitutes the teacher's local model when the preferred default is disabled", async () => {
    const teacher = await localOnlyTeacher("edm-local-only");
    // Sonnet is not in the teacher's set → the fallback must be the teacher's model.
    expect(await availability.effectiveDefaultModel(teacher, "claude-sonnet-4-6")).toBe(LOCAL);
  });
});
