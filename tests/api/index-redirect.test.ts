import { describe, it, expect, beforeAll, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";

// Mock auth so we can drive the viewer's role.
const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

type IndexRoute = typeof import("~/routes/index");
let route: IndexRoute;

beforeAll(async () => {
  route = await import("~/routes/index");
});

function loaderWith(role: "admin" | "teacher") {
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
  it("sends an admin to the user list (home = /admin/users)", async () => {
    const res = (await loaderWith("admin").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/users");
  });

  it("sends a teacher to Start (P27.3)", async () => {
    const res = (await loaderWith("teacher").catch((r) => r)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/start");
  });
});
