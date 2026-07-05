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
