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
type Cohorts = typeof import("~/server/repositories/cohorts.server");
type Registry = typeof import("~/lib/registry");

let availability: Availability;
let settings: Settings;
let users: Users;
let cohorts: Cohorts;
let registry: Registry;

const admin = { id: "admin-1", role: "admin" as const };
const student = { id: "student-1", role: "student" as const };

// Disjoint fixtures per concern so tests stay order-independent.
const STUDENT_TOOL = "mentorai"; // untouched → registry default
const INSTRUCTOR_TOOL = "bloom-by-design"; // untouched → registry default
const DISABLED_TOOL = "arcs-reactor"; // this file disables it
const BOTH_TOOL = "authentic-assessment"; // this file overrides its audience to "both"

beforeAll(async () => {
  availability = await import("~/server/availability.server");
  settings = await import("~/server/repositories/settings.server");
  users = await import("~/server/repositories/users.server");
  cohorts = await import("~/server/repositories/cohorts.server");
  registry = await import("~/lib/registry");
});

describe("getAvailableTools — registry defaults (empty settings)", () => {
  it("an admin sees registry-enabled tools of both audiences", async () => {
    const slugs = (await availability.getAvailableTools(admin)).map((t) => t.slug);
    expect(slugs).toContain(STUDENT_TOOL);
    expect(slugs).toContain(INSTRUCTOR_TOOL);
  });

  it("a student sees student tools but never an instructor tool", async () => {
    const slugs = (await availability.getAvailableTools(student)).map((t) => t.slug);
    expect(slugs).toContain(STUDENT_TOOL);
    expect(slugs).not.toContain(INSTRUCTOR_TOOL);
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

  it('audienceOverride "both" exposes an instructor tool to students', async () => {
    await settings.setToolSetting(BOTH_TOOL, { audienceOverride: "both" });
    const slugs = (await availability.getAvailableTools(student)).map((t) => t.slug);
    expect(slugs).toContain(BOTH_TOOL);
  });
});

describe("getAvailableTools — per-teacher allow-list (Phase 4)", () => {
  it("narrows a teacher with an allow-list, leaves an un-listed teacher unrestricted", async () => {
    const restricted = await users.createUser({
      name: "Restricted",
      email: "restricted@example.com",
      passwordHash: "x",
      role: "teacher",
    });
    await users.setUserToolAllowlist(restricted.id, [STUDENT_TOOL]);

    const restrictedSlugs = (
      await availability.getAvailableTools({ id: restricted.id, role: "teacher" })
    ).map((t) => t.slug);
    expect(restrictedSlugs).toContain(STUDENT_TOOL);
    expect(restrictedSlugs).not.toContain(INSTRUCTOR_TOOL);

    // A teacher with no allow-list row keeps today's behaviour (sees everything).
    const openSlugs = (
      await availability.getAvailableTools({ id: "teacher-open", role: "teacher" })
    ).map((t) => t.slug);
    expect(openSlugs).toContain(INSTRUCTOR_TOOL);
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
    expect([...ids]).toEqual(["claude-sonnet-4-6"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await settings.setEnabledModels(null); // reset
  });
});

describe("getSelectableModelIds — per-teacher & per-cohort narrowing (P13)", () => {
  const teacher = { id: "mdl-teacher", role: "teacher" as const };
  const cohortStudent = { id: "mdl-student", role: "student" as const };

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

  it("a student is narrowed by their cohort's model set (intersect)", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "mdl-teacher",
      name: "Model-restricted cohort",
      allowedToolSlugs: ["mentorai"],
      allowedModelIds: ["claude-haiku-4-5"],
    });
    await cohorts.addMembership(cohort.id, cohortStudent.id);

    const ids = await availability.getSelectableModelIds(cohortStudent);
    expect(ids.has("claude-haiku-4-5")).toBe(true);
    expect(ids.has("claude-sonnet-4-6")).toBe(false);
  });

  it("a student with no cohort restriction inherits the base", async () => {
    const ids = await availability.getSelectableModelIds({ id: "mdl-free", role: "student" });
    expect(ids.has("claude-sonnet-4-6")).toBe(true);
    expect(ids.has("claude-haiku-4-5")).toBe(true);
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
    expect([...ids]).toEqual(["claude-sonnet-4-6"]); // DEFAULT_MODEL
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

  it("a student's cohort set narrows a local/CLI id", async () => {
    const student = { id: "p14-cohort-student", role: "student" as const };
    const cohort = await cohorts.createCohort({
      createdByUserId: "p14-teacher",
      name: "Haiku-only cohort",
      allowedToolSlugs: ["mentorai"],
      allowedModelIds: ["claude-haiku-4-5"], // CLI/local excluded
    });
    await cohorts.addMembership(cohort.id, student.id);
    expect(await availability.isModelSelectableForUser(student, CLI)).toBe(false);
    expect(await availability.isModelSelectableForUser(student, LOCAL)).toBe(false);
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

// A cohort (or teacher) whose ONLY allowed model is a discovered local one
// ("ollama::…"). Such an id is never in the static catalog, so the catalog
// INTERSECT collapses to empty — but the caller is NOT locked out (the model
// rides `narrowLocalModels`). The old lockout guard mistook this for a misconfig
// and re-offered DEFAULT_MODEL (a disabled frontier default). These pin the fix.
describe("model gates — a local-only allow-list is not a lockout (bugfix)", () => {
  const LOCAL = "ollama::qwen3.6:27b-coding-nvfp4";

  async function localOnlyStudent(id: string) {
    const student = { id, role: "student" as const };
    const cohort = await cohorts.createCohort({
      createdByUserId: `${id}-teacher`,
      name: "Ollama-only cohort",
      allowedToolSlugs: ["mentorai"],
      allowedModelIds: [LOCAL], // Sonnet & the rest of the catalog excluded
    });
    await cohorts.addMembership(cohort.id, student.id);
    return student;
  }

  it("getSelectableModelIds returns an empty CATALOG set — never DEFAULT_MODEL — and does not warn", async () => {
    logMock.mockClear();
    const student = await localOnlyStudent("local-only-catalog");
    const ids = await availability.getSelectableModelIds(student);
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
    expect([...ids]).toEqual(["claude-sonnet-4-6"]); // DEFAULT_MODEL
    expect(logMock).toHaveBeenCalled();
    await users.setUserAssignedModels("bug-genuine-teacher", null); // reset
  });

  it("effectiveDefaultModel keeps the preferred default for an unrestricted caller", async () => {
    expect(await availability.effectiveDefaultModel(admin, "claude-sonnet-4-6")).toBe(
      "claude-sonnet-4-6",
    );
    expect(
      await availability.effectiveDefaultModel(
        { id: "edm-free-student", role: "student" },
        "claude-sonnet-4-6",
      ),
    ).toBe("claude-sonnet-4-6");
  });

  it("effectiveDefaultModel substitutes the cohort's local model when the preferred default is disabled", async () => {
    const student = await localOnlyStudent("edm-local-only");
    // Sonnet is not in the cohort's set → the fallback must be the cohort's model.
    expect(await availability.effectiveDefaultModel(student, "claude-sonnet-4-6")).toBe(LOCAL);
  });
});
