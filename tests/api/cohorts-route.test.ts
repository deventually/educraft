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
});
