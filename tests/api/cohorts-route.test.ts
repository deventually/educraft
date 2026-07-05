import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Stub auth: the action treats the request as the teacher named in `x-test-user`.
const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireRole: requireRoleMock }));

type Route = typeof import("~/routes/cohorts.$id");
type Cohorts = typeof import("~/server/repositories/cohorts.server");
type Profiles = typeof import("~/server/repositories/profiles.server");
let route: Route;
let cohorts: Cohorts;
let profiles: Profiles;

beforeAll(async () => {
  route = await import("~/routes/cohorts.$id");
  cohorts = await import("~/server/repositories/cohorts.server");
  profiles = await import("~/server/repositories/profiles.server");
  requireRoleMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "teacher-1",
    name: "Teacher",
    email: null,
    role: "teacher" as const,
    createdAt: new Date(0),
  }));
});

function formPost(fields: Record<string, string | string[]>, userId: string): Request {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) for (const x of v) body.append(k, x);
    else body.append(k, v);
  }
  return new Request("http://localhost/cohorts/new", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "x-test-user": userId },
    body: body.toString(),
  });
}

type ActionArgs = Parameters<Route["action"]>[0];
const args = (params: Record<string, string>, request: Request) =>
  ({ params, request, context: {} }) as unknown as ActionArgs;

describe("cohorts.$id action — provisioning", () => {
  it("creates a cohort and mints one invite per recipient", async () => {
    const res = (await route.action(
      args(
        { id: "new" },
        formPost(
          {
            name: "SE jaar 2",
            tools: ["mentorai", "socratic-partner"],
            emails: "a@example.com\nb@example.com",
            linkCount: "1",
            expiryDays: "7",
          },
          "teacher-1",
        ),
      ),
    )) as { links?: { url: string; email: string | null }[]; error?: string };

    expect(res.error).toBeUndefined();
    // 2 email-bound + 1 link-only = 3 invites.
    expect(res.links).toHaveLength(3);
    expect(res.links?.filter((l) => l.email).length).toBe(2);
    expect(res.links?.some((l) => l.email === null)).toBe(true);

    const owned = await cohorts.listCohortsByOwner("teacher-1");
    expect(owned.some((c) => c.name === "SE jaar 2")).toBe(true);
  });

  it("rejects a context profile the teacher does not own (no cohort created, no leak)", async () => {
    // A profile owned by a DIFFERENT teacher.
    const foreign = await profiles.createProfile("teacher-2", { name: "Other's profile" });

    const res = (await route.action(
      args(
        { id: "new" },
        formPost(
          {
            name: "Sneaky cohort",
            tools: ["mentorai"],
            emails: "x@example.com",
            contextSource: "profile",
            contextProfileId: foreign.id,
          },
          "teacher-1",
        ),
      ),
    )) as { links?: unknown; error?: string };

    // The action refuses and mints nothing.
    expect(res.error).toBeTruthy();
    expect(res.links).toBeUndefined();
    const owned = await cohorts.listCohortsByOwner("teacher-1");
    expect(owned.some((c) => c.name === "Sneaky cohort")).toBe(false);
  });

  it("lets an assigned co-teacher manage a cohort they did not create", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-99",
      name: "Team cohort",
      allowedToolSlugs: ["mentorai"],
    });
    await cohorts.addCohortTeacher(cohort.id, "co-99");

    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost({ name: "Team cohort", tools: ["mentorai"], emails: "s@example.com" }, "co-99"),
      ),
    )) as { links?: unknown[]; error?: string };

    expect(res.error).toBeUndefined();
    expect(res.links).toHaveLength(1);
  });

  it("404s a teacher who neither created nor is assigned to the cohort", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-100",
      name: "Private cohort",
      allowedToolSlugs: ["mentorai"],
    });

    await expect(
      route.action(
        args(
          { id: cohort.id },
          formPost(
            { name: "Private cohort", tools: ["mentorai"], emails: "s@example.com" },
            "stranger-1",
          ),
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("accepts the teacher's own context profile", async () => {
    const mine = await profiles.createProfile("teacher-3", { name: "My profile" });
    const res = (await route.action(
      args(
        { id: "new" },
        formPost(
          {
            name: "Legit cohort",
            tools: ["mentorai"],
            emails: "y@example.com",
            contextSource: "profile",
            contextProfileId: mine.id,
          },
          "teacher-3",
        ),
      ),
    )) as { links?: unknown[]; error?: string };

    expect(res.error).toBeUndefined();
    expect(res.links).toHaveLength(1);
    const owned = await cohorts.listCohortsByOwner("teacher-3");
    const cohort = owned.find((c) => c.name === "Legit cohort");
    expect(cohort?.contextProfileId).toBe(mine.id);
  });

  it("lets only an admin delete a cohort from the manage page", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-del",
      name: "Deletable",
      allowedToolSlugs: ["mentorai"],
    });

    // A teacher (even one who could manage it) is refused — delete is admin-only.
    await expect(
      route.action(args({ id: cohort.id }, formPost({ intent: "deleteCohort" }, "owner-del"))),
    ).rejects.toMatchObject({ status: 403 });
    expect(await cohorts.getCohort(cohort.id)).not.toBeNull();

    // An admin succeeds: the cohort is deleted and the action redirects.
    requireRoleMock.mockImplementationOnce(async () => ({
      id: "admin-1",
      name: "Admin",
      email: null,
      role: "admin" as const,
      createdAt: new Date(0),
    }));
    await expect(
      route.action(args({ id: cohort.id }, formPost({ intent: "deleteCohort" }, "admin-1"))),
    ).rejects.toMatchObject({ status: 302 });
    expect(await cohorts.getCohort(cohort.id)).toBeNull();
  });

  it("levels a cohort by a bare EQF number (no profile)", async () => {
    const res = (await route.action(
      args(
        { id: "new" },
        formPost(
          {
            name: "EQF cohort",
            tools: ["mentorai"],
            emails: "z@example.com",
            contextSource: "eqf",
            contextEqf: "5",
          },
          "teacher-eqf",
        ),
      ),
    )) as { links?: unknown[]; error?: string };

    expect(res.error).toBeUndefined();
    const owned = await cohorts.listCohortsByOwner("teacher-eqf");
    const cohort = owned.find((c) => c.name === "EQF cohort");
    expect(cohort?.contextEqf).toBe(5);
    expect(cohort?.contextProfileId).toBeNull();
  });
});

describe("cohorts.$id action — editing an existing cohort", () => {
  it("saves a cohort's tool changes in place and mints no invites when no recipients are given", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "edit-teacher",
      name: "Editable",
      allowedToolSlugs: ["mentorai"],
    });

    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost({ name: "Editable", tools: ["mentorai", "socratic-partner"] }, "edit-teacher"),
      ),
    )) as { saved?: boolean; links?: unknown };

    expect(res.saved).toBe(true);
    // A settings-only save is decoupled from inviting — no batch is minted.
    expect(res.links).toBeUndefined();

    const updated = await cohorts.getCohort(cohort.id);
    expect(updated && [...cohorts.allowedSlugsOf(updated)].sort()).toEqual([
      "mentorai",
      "socratic-partner",
    ]);
  });

  it("also mints invites in the same save when recipients are included", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "edit-teacher-inv",
      name: "Edit + invite",
      allowedToolSlugs: ["mentorai"],
    });

    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost(
          { name: "Edit + invite", tools: ["mentorai", "peer-tutoring"], emails: "new@x.com" },
          "edit-teacher-inv",
        ),
      ),
    )) as { saved?: boolean; links?: { url: string }[] };

    expect(res.saved).toBe(true);
    expect(res.links).toHaveLength(1);
    const updated = await cohorts.getCohort(cohort.id);
    expect([...cohorts.allowedSlugsOf(updated!)].sort()).toEqual(["mentorai", "peer-tutoring"]);
  });

  it("rejects a settings save with no tutor selected (cohort unchanged)", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "edit-teacher-2",
      name: "Keeps tools",
      allowedToolSlugs: ["mentorai"],
    });

    const res = (await route.action(
      args({ id: cohort.id }, formPost({ name: "Keeps tools" }, "edit-teacher-2")),
    )) as { saved?: boolean; error?: string };

    expect(res.error).toBeTruthy();
    expect(res.saved).toBeUndefined();
    const unchanged = await cohorts.getCohort(cohort.id);
    expect([...cohorts.allowedSlugsOf(unchanged!)]).toEqual(["mentorai"]);
  });

  it("404s a teacher who may not manage the cohort — before any side effect", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-edit",
      name: "Not yours",
      allowedToolSlugs: ["mentorai"],
    });

    await expect(
      route.action(
        args(
          { id: cohort.id },
          formPost({ name: "Not yours", tools: ["mentorai"] }, "stranger-edit"),
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("lets an admin save tool changes on a cohort they do not own", async () => {
    const cohort = await cohorts.createCohort({
      createdByUserId: "some-teacher",
      name: "Admin edits",
      allowedToolSlugs: ["mentorai"],
    });
    requireRoleMock.mockImplementationOnce(async () => ({
      id: "admin-9",
      name: "Admin",
      email: null,
      role: "admin" as const,
      createdAt: new Date(0),
    }));

    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost({ name: "Admin edits", tools: ["peer-tutoring"] }, "admin-9"),
      ),
    )) as { saved?: boolean };

    expect(res.saved).toBe(true);
    const updated = await cohorts.getCohort(cohort.id);
    expect([...cohorts.allowedSlugsOf(updated!)]).toEqual(["peer-tutoring"]);
  });

  it("preserves a context profile owned by someone else when an admin edits the tools", async () => {
    // Teacher A owns profile P; their cohort levels members by P.
    const p = await profiles.createProfile("owner-prof", { name: "A's profile" });
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-prof",
      name: "Levelled",
      allowedToolSlugs: ["mentorai"],
      contextProfileId: p.id,
    });

    // An admin edits the tools. Their profile dropdown can't show A's profile, so
    // the "profile" source submits an empty id — this must NOT wipe A's profile.
    requireRoleMock.mockImplementationOnce(async () => ({
      id: "admin-prof",
      name: "Admin",
      email: null,
      role: "admin" as const,
      createdAt: new Date(0),
    }));
    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost(
          { name: "Levelled", tools: ["mentorai", "socratic-partner"], contextSource: "profile" },
          "admin-prof",
        ),
      ),
    )) as { saved?: boolean };

    expect(res.saved).toBe(true);
    const updated = await cohorts.getCohort(cohort.id);
    expect(updated?.contextProfileId).toBe(p.id); // preserved, not cleared
    expect([...cohorts.allowedSlugsOf(updated!)].sort()).toEqual(["mentorai", "socratic-partner"]);
  });

  it("still lets an editor clear the level explicitly via 'no level'", async () => {
    const p = await profiles.createProfile("owner-prof2", { name: "A's profile 2" });
    const cohort = await cohorts.createCohort({
      createdByUserId: "owner-prof2",
      name: "Levelled 2",
      allowedToolSlugs: ["mentorai"],
      contextProfileId: p.id,
    });

    requireRoleMock.mockImplementationOnce(async () => ({
      id: "admin-prof2",
      name: "Admin",
      email: null,
      role: "admin" as const,
      createdAt: new Date(0),
    }));
    const res = (await route.action(
      args(
        { id: cohort.id },
        formPost({ name: "Levelled 2", tools: ["mentorai"], contextSource: "none" }, "admin-prof2"),
      ),
    )) as { saved?: boolean };

    expect(res.saved).toBe(true);
    const updated = await cohorts.getCohort(cohort.id);
    expect(updated?.contextProfileId).toBeNull(); // explicit clear honoured
  });
});
