import { describe, it, expect, beforeAll, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ requireUser: requireUserMock }));

type Route = typeof import("~/routes/set-view");
let route: Route;

beforeAll(async () => {
  route = await import("~/routes/set-view");
});

function post(role: "admin" | "teacher", view: string): Request {
  requireUserMock.mockResolvedValueOnce({
    id: "u1",
    name: "U",
    email: null,
    role,
    createdAt: new Date(0),
  });
  const body = new URLSearchParams({ view, redirectTo: "/tools/mentorai" }).toString();
  return new Request("http://localhost/set-view", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

const invoke = (req: Request) =>
  route.action({ request: req, params: {} } as Parameters<Route["action"]>[0]) as Promise<Response>;

describe("set-view action", () => {
  it("sets the teacher view for an admin and redirects back", async () => {
    const res = await invoke(post("admin", "teacher"));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/tools/mentorai");
    expect(res.headers.get("Set-Cookie")).toContain("viewAs=teacher");
  });

  it("clears the view when an admin switches back to admin", async () => {
    const res = await invoke(post("admin", "admin"));
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("ignores a non-admin trying to set a view (no privilege change)", async () => {
    // A teacher's request never yields a teacher-downshift cookie — the guard
    // collapses it to the clear-cookie path.
    const res = await invoke(post("teacher", "teacher"));
    expect(res.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(res.headers.get("Set-Cookie")).not.toContain("viewAs=teacher;");
  });
});
