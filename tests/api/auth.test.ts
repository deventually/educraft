import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");
let auth: Auth;
let users: Users;

beforeAll(async () => {
  auth = await import("~/server/auth.server");
  users = await import("~/server/repositories/users.server");
});

/** Mint a session cookie header for a user id via createUserSession's Set-Cookie. */
async function sessionCookieFor(userId: string): Promise<string> {
  const res = await auth.createUserSession(userId, "/");
  const setCookie = res.headers.get("Set-Cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  expect(cookie).toContain("__session=");
  return cookie;
}

function requestWithCookie(cookie?: string): Request {
  return new Request("http://localhost/", {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

describe("auth helpers", () => {
  it("getUser returns null and requireUser redirects to /login without a session", async () => {
    const req = requestWithCookie();
    expect(await auth.getUser(req)).toBeNull();

    let thrown: unknown;
    try {
      await auth.requireUser(req);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    const res = thrown as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login");
  });

  it("requireUser returns the user for a valid session cookie", async () => {
    const created = await users.createUser({
      name: "Teacher T",
      email: "t@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const cookie = await sessionCookieFor(created.id);
    const user = await auth.requireUser(requestWithCookie(cookie));
    expect(user.id).toBe(created.id);
    expect(user.role).toBe("teacher");
    // The public user shape never leaks the password hash.
    expect((user as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it("requireRole throws a 403 Response when the role is insufficient", async () => {
    const teacher = await users.createUser({
      name: "Only Teacher",
      email: "only@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const cookie = await sessionCookieFor(teacher.id);

    let thrown: unknown;
    try {
      await auth.requireRole(requestWithCookie(cookie), "admin");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("requireRole passes through when the role matches", async () => {
    const admin = await users.createUser({
      name: "Admin A",
      email: "admin@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "admin",
    });
    const cookie = await sessionCookieFor(admin.id);
    const user = await auth.requireRole(requestWithCookie(cookie), "admin");
    expect(user.role).toBe("admin");
  });
});

describe("single active session (Phase 6 anti-sharing)", () => {
  it("treats a stale sessionVersion cookie as logged out after a newer login", async () => {
    const u = await users.createUser({
      name: "Multi Device",
      email: "multi@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "student",
    });
    // Two successive logins mint two cookies; the second bumps sessionVersion.
    const cookie1 = await sessionCookieFor(u.id);
    const cookie2 = await sessionCookieFor(u.id);

    // The newest cookie authenticates…
    expect((await auth.getUser(requestWithCookie(cookie2)))?.id).toBe(u.id);
    // …the older one no longer does (its sessionVersion is stale).
    expect(await auth.getUser(requestWithCookie(cookie1))).toBeNull();
  });
});
