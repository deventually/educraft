import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");
type Login = typeof import("~/routes/login");
type I18n = typeof import("~/lib/i18n");
type LocaleServer = typeof import("~/lib/i18n/locale.server");
type Password = typeof import("~/server/password.server");
let auth: Auth;
let users: Users;
let login: Login;
let i18n: I18n;
let localeServer: LocaleServer;
let password: Password;

beforeAll(async () => {
  auth = await import("~/server/auth.server");
  users = await import("~/server/repositories/users.server");
  login = await import("~/routes/login");
  i18n = await import("~/lib/i18n");
  localeServer = await import("~/lib/i18n/locale.server");
  password = await import("~/server/password.server");
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

describe("disabled account (Phase 14)", () => {
  it("getUser returns null for a disabled account even with a valid cookie", async () => {
    const u = await users.createUser({
      name: "To Disable",
      email: "todisable@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "student",
    });
    const cookie = await sessionCookieFor(u.id);
    // Active first…
    expect((await auth.getUser(requestWithCookie(cookie)))?.id).toBe(u.id);
    // …then disabling logs them out everywhere (session version unchanged).
    await users.requestAccountDeletion(u.id);
    expect(await auth.getUser(requestWithCookie(cookie))).toBeNull();
  });

  it("the login action refuses a disabled account despite correct credentials", async () => {
    const pw = "correct horse battery staple";
    const u = await users.createUser({
      name: "Blocked",
      email: "blocked@example.com",
      passwordHash: password.hashPassword(pw),
      role: "student",
    });
    await users.requestAccountDeletion(u.id);
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "blocked@example.com", password: pw }).toString(),
    });
    const m = i18n.getMessages(localeServer.getLocale(req));
    const res = (await login.action({ request: req } as Parameters<typeof login.action>[0])) as {
      error?: string;
    };
    expect(res.error).toBe(m.auth.accountDisabled);
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
