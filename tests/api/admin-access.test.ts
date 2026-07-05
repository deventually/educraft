import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");

let auth: Auth;
let users: Users;

// Every admin route's guarded entry points. If a new admin route ships without
// its own requireRole("admin"), it must be added here — and it will fail until
// the guard exists (loaders run in parallel; each repeats the check).
interface Guarded {
  name: string;
  fn: (args: { request: Request; params: Record<string, string> }) => unknown;
}
let guarded: Guarded[];

let teacherCookie: string;
let studentCookie: string;

async function cookieFor(role: "teacher" | "student"): Promise<string> {
  const u = await users.createUser({
    name: `${role} user`,
    email: `${role}-${Math.round(performance.now() * 1000)}@example.com`,
    passwordHash: "scrypt:aa:bb",
    role,
  });
  const res = await auth.createUserSession(u.id, "/");
  return (res.headers.get("Set-Cookie") ?? "").split(";")[0];
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
  studentCookie = await cookieFor("student");

  const [layout, index, tools, models, invites, cohorts, usage, feedback] = await Promise.all([
    import("~/routes/admin"),
    import("~/routes/admin._index"),
    import("~/routes/admin.tools"),
    import("~/routes/admin.models"),
    import("~/routes/admin.invites"),
    import("~/routes/admin.cohorts"),
    import("~/routes/admin.usage"),
    import("~/routes/admin.feedback"),
  ]);
  const g = (name: string, fn: unknown) => ({ name, fn: fn as Guarded["fn"] });
  guarded = [
    g("admin layout loader", layout.loader),
    g("admin index loader", index.loader),
    g("admin.tools loader", tools.loader),
    g("admin.tools action", tools.action),
    g("admin.models loader", models.loader),
    g("admin.models action", models.action),
    g("admin.invites loader", invites.loader),
    g("admin.invites action", invites.action),
    g("admin.cohorts loader", cohorts.loader),
    g("admin.cohorts action", cohorts.action),
    g("admin.usage loader", usage.loader),
    g("admin.feedback loader", feedback.loader),
  ];
});

describe("admin routes — access control", () => {
  it("rejects a teacher with a 403 on every loader and action", async () => {
    for (const { name, fn } of guarded) {
      const thrown = await catchThrow(fn, req(teacherCookie));
      expect(thrown, name).toBeInstanceOf(Response);
      expect((thrown as Response).status, name).toBe(403);
    }
  });

  it("rejects a student with a 403 on every loader and action", async () => {
    for (const { name, fn } of guarded) {
      const thrown = await catchThrow(fn, req(studentCookie));
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
