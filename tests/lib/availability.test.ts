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
