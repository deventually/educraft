import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

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
  it("a teacher sees every instance-enabled tool", async () => {
    const legacy = await users.createUser({
      name: "Legacy",
      email: "legacy@example.com",
      passwordHash: "x",
      role: "teacher",
    });
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

  it("falls back to the default model (and warns) when the instance set is empty", async () => {
    logMock.mockClear();
    await settings.setEnabledModels(["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds();
    expect([...ids]).toEqual(["claude-sonnet-5-5"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await settings.setEnabledModels(null); // reset
  });
});

describe("getSelectableModelIds — per-teacher override (P18)", () => {
  const teacher = { id: "mdl-teacher", role: "teacher" as const };

  it("an admin always gets the instance set", async () => {
    await settings.setEnabledModels(["claude-haiku-4-5"]);
    // Even a stray assignment under an admin's id is never read.
    await users.setUserAssignedModels(admin.id, ["claude-sonnet-4-6"]);
    const forAdmin = await availability.getSelectableModelIds(admin);
    expect([...forAdmin]).toEqual(["claude-haiku-4-5"]);
    await users.setUserAssignedModels(admin.id, null);
    await settings.setEnabledModels(null); // reset
  });

  it("a teacher without an own set follows the instance", async () => {
    await settings.setEnabledModels(["claude-haiku-4-5"]);
    const ids = await availability.getSelectableModelIds(teacher);
    expect([...ids]).toEqual(["claude-haiku-4-5"]);
    await settings.setEnabledModels(null); // reset
  });

  it("a teacher's own set replaces the instance set, also when wider", async () => {
    await settings.setEnabledModels(["claude-haiku-4-5"]);
    await users.setUserAssignedModels(teacher.id, ["claude-sonnet-4-6", "claude-haiku-4-5"]);
    const ids = await availability.getSelectableModelIds(teacher);
    expect(ids.has("claude-sonnet-4-6")).toBe(true); // outside the instance set
    expect(ids.has("claude-haiku-4-5")).toBe(true);
    expect(await availability.isModelSelectableForUser(teacher, "claude-sonnet-4-6")).toBe(true);
    await users.setUserAssignedModels(teacher.id, null);
    await settings.setEnabledModels(null); // reset
  });

  it("a teacher's own set may also be narrower; clearing it restores the instance", async () => {
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const own = await availability.getSelectableModelIds(teacher);
    expect([...own]).toEqual(["claude-haiku-4-5"]);

    await users.setUserAssignedModels(teacher.id, null);
    const inherited = await availability.getSelectableModelIds(teacher);
    expect(inherited.has("claude-sonnet-4-6")).toBe(true); // back to the instance
  });

  it("getSelectableModels mirrors the override for the picker", async () => {
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]);
    const models = await availability.getSelectableModels(teacher);
    expect(models.map((m) => m.id)).toEqual(["claude-haiku-4-5"]);
    await users.setUserAssignedModels(teacher.id, null); // reset
    await settings.setEnabledModels(null);
  });

  it("an own set of only unknown ids falls back to the instance set, not DEFAULT_MODEL", async () => {
    logMock.mockClear();
    await settings.setEnabledModels(["claude-haiku-4-5"]);
    await users.setUserAssignedModels(teacher.id, ["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds(teacher);
    expect([...ids]).toEqual(["claude-haiku-4-5"]); // the instance set, not DEFAULT_MODEL
    expect(logMock).not.toHaveBeenCalled();
    expect(await availability.isModelSelectableForUser(teacher, "claude-haiku-4-5")).toBe(true);
    expect(await availability.isModelSelectableForUser(teacher, "claude-sonnet-4-6")).toBe(false);
    await users.setUserAssignedModels(teacher.id, null); // reset
    await settings.setEnabledModels(null);
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

  it("a teacher's own set decides a local/CLI id (override); clearing restores the instance", async () => {
    await users.setUserAssignedModels(teacher.id, ["claude-haiku-4-5"]); // no CLI
    expect(await availability.isModelSelectableForUser(teacher, CLI)).toBe(false);
    // An own set may include a CLI agent the instance has not enabled.
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    await users.setUserAssignedModels(teacher.id, [CLI]);
    expect(await availability.isModelSelectableForUser(teacher, CLI)).toBe(true);
    await settings.setEnabledModels(null);
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
// own set has no catalog half — but the caller is NOT locked out (the model
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

  it("still rescues a GENUINE lockout (a stale instance allow-list and no usable own set) with DEFAULT_MODEL", async () => {
    logMock.mockClear();
    await settings.setEnabledModels(["nonexistent-model-xyz"]);
    await users.setUserAssignedModels("bug-genuine-teacher", ["nonexistent-model-xyz"]);
    const ids = await availability.getSelectableModelIds({
      id: "bug-genuine-teacher",
      role: "teacher",
    });
    expect([...ids]).toEqual(["claude-sonnet-5-5"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await users.setUserAssignedModels("bug-genuine-teacher", null); // reset
    await settings.setEnabledModels(null);
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

describe("CLI and local models exist only outside production (P18)", () => {
  const CLI = "claude-code";
  const LOCAL = "ollama::p18-model";
  const teacher = { id: "p18-prod-teacher", role: "teacher" as const };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("localModelsEnabled reads NODE_ENV on every call", async () => {
    const env = await import("~/server/env.server");
    vi.stubEnv("NODE_ENV", "production");
    expect(env.localModelsEnabled()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(env.localModelsEnabled()).toBe(true);
  });

  it("hides CLI and local models in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await availability.isModelSelectableForUser(undefined, CLI)).toBe(false);
    expect(await availability.isModelSelectableForUser(undefined, LOCAL)).toBe(false);
    expect(await availability.isModelSelectableForUser(undefined, "claude-sonnet-4-6")).toBe(true);
    const ids = await availability.getSelectableModelIds();
    for (const cli of ["claude-code", "codex", "gemini-cli", "opencode"]) {
      expect(ids.has(cli)).toBe(false);
    }
    expect(ids.has("claude-sonnet-4-6")).toBe(true);
    const discovered = [{ id: LOCAL, displayName: LOCAL }];
    expect(await availability.narrowLocalModels(undefined, discovered)).toEqual([]);
  });

  it("an own set naming a CLI agent is ignored in production (filtered, then the instance set)", async () => {
    await users.setUserAssignedModels(teacher.id, [CLI]);
    vi.stubEnv("NODE_ENV", "production");
    expect(await availability.isModelSelectableForUser(teacher, CLI)).toBe(false);
    const ids = await availability.getSelectableModelIds(teacher);
    expect(ids.has("claude-sonnet-4-6")).toBe(true); // follows the instance
    await users.setUserAssignedModels(teacher.id, null);
  });

  it("offers CLI and local models outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await availability.isModelSelectableForUser(undefined, CLI)).toBe(true);
    expect(await availability.isModelSelectableForUser(undefined, LOCAL)).toBe(true);
    const ids = await availability.getSelectableModelIds();
    expect(ids.has(CLI)).toBe(true);
  });
});
