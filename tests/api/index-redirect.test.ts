import { describe, it, expect, beforeAll, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

// Mock auth so we can drive the viewer's role; getEffectiveRole (real) then reads
// the (absent) view-as cookie and returns the real role.
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

type IndexRoute = typeof import("~/routes/index");
let route: IndexRoute;

beforeAll(async () => {
  route = await import("~/routes/index");
});

function loaderWith(role: "admin" | "teacher" | "student") {
  requireUserMock.mockResolvedValueOnce({
    id: "u",
    name: "U",
    email: null,
    role,
    createdAt: new Date(0),
  });
  return route.loader({
    request: new Request("http://localhost/"),
    params: {},
    context: {},
  } as never);
}

describe("home redirector", () => {
  it("sends an admin to the admin console (home = /admin)", async () => {
    const res = (await loaderWith("admin").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin");
  });

  it("sends a teacher to the tool catalogue at /tools", async () => {
    const res = (await loaderWith("teacher").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/tools");
  });

  it("sends a student to /tools", async () => {
    const res = (await loaderWith("student").catch((r) => r)) as Response;
    expect(res.headers.get("Location")).toBe("/tools");
  });
});
