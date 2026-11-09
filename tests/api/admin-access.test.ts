import { describe, it, expect, beforeAll } from "vitest";
import { flatRoutes } from "../helpers/routes";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");

let auth: Auth;
let users: Users;

// Every admin route's guarded entry points, derived from the route table: a new admin
// route is checked automatically and fails until it has its own requireRole("admin")
// (loaders run in parallel; each repeats the check).
interface Guarded {
  name: string;
  fn: (args: { request: Request; params: Record<string, string> }) => unknown;
}
let guarded: Guarded[];

let teacherCookie: string;

/** The admin layout and every page under it, as files relative to `app/`. */
const adminRouteFiles = (): string[] =>
  flatRoutes()
    .filter((r) => r.path === "/admin" || r.path.startsWith("/admin/"))
    .map((r) => r.file);

async function cookieFor(role: "teacher"): Promise<string> {
  const u = await users.createUser({
    name: `${role} user`,
    email: `${role}-${Math.round(performance.now() * 1000)}@example.com`,
    passwordHash: "scrypt:aa:bb",
    role,
  });
  const res = await auth.createUserSession(u.id, "/");
  return (res.headers.get("Set-Cookie") ?? "").split(";")[0]!;
}

function req(cookie?: string): Request {
  return new Request("http://localhost/admin", {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
  });
}

/** Invoke a guard and return the thrown value (fails if nothing is thrown). */
async function catchThrow(fn: Guarded["fn"], request: Request): Promise<unknown> {
  try {
    await fn({ request, params: {} });
  } catch (e) {
    return e;
  }
  throw new Error("expected the guard to throw");
}

beforeAll(async () => {
  auth = await import("~/server/auth.server");
  users = await import("~/server/repositories/users.server");
  teacherCookie = await cookieFor("teacher");

  guarded = [];
  for (const file of adminRouteFiles()) {
    const mod = (await import(`~/${file}`)) as Partial<Record<"loader" | "action", Guarded["fn"]>>;
    for (const kind of ["loader", "action"] as const) {
      const fn = mod[kind];
      if (fn) guarded.push({ name: `${file} ${kind}`, fn });
    }
  }
});

describe("admin routes — access control", () => {
  it("covers every admin route, each with at least a loader", () => {
    const files = adminRouteFiles();
    expect(files).toContain("routes/admin.tsx");
    expect(files.length).toBeGreaterThan(10);
    for (const file of files)
      expect(
        guarded.map((g) => g.name),
        file,
      ).toContain(`${file} loader`);
  });

  it("rejects a teacher with a 403 on every loader and action", async () => {
    for (const { name, fn } of guarded) {
      const thrown = await catchThrow(fn, req(teacherCookie));
      expect(thrown, name).toBeInstanceOf(Response);
      expect((thrown as Response).status, name).toBe(403);
    }
  });

  it("redirects an anonymous request to /login on every loader and action", async () => {
    for (const { name, fn } of guarded) {
      const thrown = await catchThrow(fn, req());
      expect(thrown, name).toBeInstanceOf(Response);
      expect((thrown as Response).status, name).toBe(302);
      expect((thrown as Response).headers.get("Location"), name).toBe("/login");
    }
  });
});
