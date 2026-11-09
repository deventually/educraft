import { describe, it, expect, beforeAll } from "vitest";
import { flashKeyOf } from "../helpers/flash";

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
  const cookie = setCookie.split(";")[0]!;
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

describe("legacy student rows (P17)", () => {
  it("treats a legacy student row as logged out", async () => {
    const u = await users.createUser({
      name: "Legacy Student",
      email: "legacy@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "student" as never,
    });
    const cookie = await sessionCookieFor(u.id);
    expect(await auth.getUser(requestWithCookie(cookie))).toBeNull();
  });

  it("login refuses a legacy student account with the generic message", async () => {
    const pw = "correct horse battery staple";
    await users.createUser({
      name: "Legacy Login",
      email: "legacylogin@example.com",
      passwordHash: await password.hashPassword(pw),
      role: "student" as never,
    });
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "legacylogin@example.com", password: pw }).toString(),
    });
    const m = i18n.getMessages(localeServer.getLocale(req));
    const res = (await login.action({ request: req } as Parameters<typeof login.action>[0])) as {
      error?: string;
    };
    expect(res.error).toBe(m.auth.loginFailed);
  });
});

describe("multiple devices (P17)", () => {
  it("a second login keeps the first session valid", async () => {
    const u = await users.createUser({
      name: "Multi Device",
      email: "multi@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const cookie1 = await sessionCookieFor(u.id);
    const cookie2 = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(cookie1)))?.id).toBe(u.id);
    expect((await auth.getUser(requestWithCookie(cookie2)))?.id).toBe(u.id);
  });

  it("a password update logs out every older session but not a freshly minted one", async () => {
    const u = await users.createUser({
      name: "Pw Change",
      email: "pwchange@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const old = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(old)))?.id).toBe(u.id);
    await users.updateUserPassword(u.id, "scrypt:cc:dd");
    expect(await auth.getUser(requestWithCookie(old))).toBeNull();
    const fresh = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(fresh)))?.id).toBe(u.id);
  });
});

describe("deactivated accounts (P18.7)", () => {
  const PW = "correct horse battery staple";
  const loginReq = (email: string, pw: string) =>
    new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email, password: pw }).toString(),
    });
  const runLogin = (req: Request) =>
    login.action({ request: req } as Parameters<typeof login.action>[0]);
  const msgs = (req: Request) => i18n.getMessages(localeServer.getLocale(req));

  it("a new user is active (disabledAt null)", async () => {
    const u = await users.createUser({
      name: "Active",
      email: "active-p187@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    expect(u.disabledAt).toBeNull();
    expect((await users.getUserById(u.id))?.disabledAt).toBeNull();
  });

  it("a deactivated user is logged out everywhere", async () => {
    const u = await users.createUser({
      name: "Gone Dark",
      email: "gonedark@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const phone = await sessionCookieFor(u.id);
    const laptop = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(phone)))?.id).toBe(u.id);

    await users.setUserDisabled(u.id, true);

    expect(await auth.getUser(requestWithCookie(phone))).toBeNull();
    expect(await auth.getUser(requestWithCookie(laptop))).toBeNull();
    // requireUser sends a deactivated session to /login like any logged-out visitor.
    await expect(auth.requireUser(requestWithCookie(phone))).rejects.toMatchObject({
      status: 302,
    });
    const row = await users.getUserById(u.id);
    expect(row?.disabledAt).toBeInstanceOf(Date);
    // The data stays.
    expect(row?.email).toBe("gonedark@example.com");
  });

  it("login refuses a deactivated account with accountDisabled after a correct password", async () => {
    const u = await users.createUser({
      name: "Disabled Login",
      email: "disabledlogin@example.com",
      passwordHash: await password.hashPassword(PW),
      role: "teacher",
    });
    await users.setUserDisabled(u.id, true);
    const req = loginReq("disabledlogin@example.com", PW);
    const res = (await runLogin(req)) as { error?: string };
    expect(res instanceof Response).toBe(false);
    expect(res.error).toBe(msgs(req).auth.accountDisabled);
    expect(msgs(req).auth.accountDisabled).not.toBe(msgs(req).auth.loginFailed);
  });

  it("login with a wrong password on a deactivated account stays generic", async () => {
    const u = await users.createUser({
      name: "Disabled Wrong",
      email: "disabledwrong@example.com",
      passwordHash: await password.hashPassword(PW),
      role: "teacher",
    });
    await users.setUserDisabled(u.id, true);
    const req = loginReq("disabledwrong@example.com", "not the password");
    const res = (await runLogin(req)) as { error?: string };
    expect(res.error).toBe(msgs(req).auth.loginFailed);
    // Same answer as for an address that does not exist: no account enumeration.
    const ghost = (await runLogin(loginReq("nobody-p187@example.com", "x"))) as { error?: string };
    expect(ghost.error).toBe(res.error);
  });

  it("an account created without a password (set-password link) cannot log in", async () => {
    await users.createUser({
      name: "No Pw Yet",
      email: "nopwyet@example.com",
      passwordHash: password.NO_PASSWORD,
      role: "teacher",
    });
    for (const typed of ["none", PW, "scrypt::"]) {
      const req = loginReq("nopwyet@example.com", typed);
      const res = (await runLogin(req)) as { error?: string };
      expect(res instanceof Response).toBe(false);
      expect(res.error).toBe(msgs(req).auth.loginFailed);
    }
  });

  it("reactivating restores login but not old cookies", async () => {
    const u = await users.createUser({
      name: "Back Again",
      email: "backagain@example.com",
      passwordHash: await password.hashPassword(PW),
      role: "teacher",
    });
    const old = await sessionCookieFor(u.id);
    await users.setUserDisabled(u.id, true);
    await users.setUserDisabled(u.id, false);

    expect((await users.getUserById(u.id))?.disabledAt).toBeNull();
    // The old cookie stays dead: deactivating bumped sessionVersion.
    expect(await auth.getUser(requestWithCookie(old))).toBeNull();
    // A fresh login works again.
    const res = await runLogin(loginReq("backagain@example.com", PW));
    expect(res instanceof Response).toBe(true);
    const fresh = ((res as Response).headers.get("Set-Cookie") ?? "").split(";")[0];
    expect((await auth.getUser(requestWithCookie(fresh)))?.id).toBe(u.id);
  });

  it("deactivating twice bumps once; reactivating never bumps", async () => {
    const u = await users.createUser({
      name: "Counter",
      email: "counter-p187@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const v0 = (await users.getUserById(u.id))!.sessionVersion;
    await users.setUserDisabled(u.id, true);
    const v1 = (await users.getUserById(u.id))!.sessionVersion;
    expect(v1).toBe(v0 + 1);
    await users.setUserDisabled(u.id, true);
    expect((await users.getUserById(u.id))!.sessionVersion).toBe(v1);
    await users.setUserDisabled(u.id, false);
    expect((await users.getUserById(u.id))!.sessionVersion).toBe(v1);
  });

  it("promoting or demoting logs the user out on every device (P18.9)", async () => {
    const u = await users.createUser({
      name: "Role Change",
      email: "rolechange-p189@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const laptop = await sessionCookieFor(u.id);
    const phone = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(laptop)))?.id).toBe(u.id);

    await users.setUserRole(u.id, "admin");
    expect(await auth.getUser(requestWithCookie(laptop))).toBeNull();
    expect(await auth.getUser(requestWithCookie(phone))).toBeNull();

    // A fresh session works, and a demotion kills it again.
    const asAdmin = await sessionCookieFor(u.id);
    expect((await auth.getUser(requestWithCookie(asAdmin)))?.role).toBe("admin");
    await users.setUserRole(u.id, "teacher");
    expect(await auth.getUser(requestWithCookie(asAdmin))).toBeNull();
  });

  it("setting the role a user already has does not bump the session version", async () => {
    const u = await users.createUser({
      name: "Same Role",
      email: "samerole-p189@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const cookie = await sessionCookieFor(u.id);
    const v0 = (await users.getUserById(u.id))!.sessionVersion;
    await users.setUserRole(u.id, "teacher");
    expect((await users.getUserById(u.id))!.sessionVersion).toBe(v0);
    expect((await auth.getUser(requestWithCookie(cookie)))?.id).toBe(u.id);
  });
});

describe("redirect toasts (P16)", () => {
  it("a successful login lands with a 'signed in' toast", async () => {
    const pw = "correct horse battery staple";
    await users.createUser({
      name: "Flash Login",
      email: "flashlogin@example.com",
      passwordHash: await password.hashPassword(pw),
      role: "teacher",
    });
    const req = new Request("http://localhost/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "flashlogin@example.com", password: pw }).toString(),
    });
    const res = await login.action({ request: req } as Parameters<typeof login.action>[0]);
    expect(await flashKeyOf(res)).toBe("signedIn");
  });

  it("logging out lands on /login with a 'signed out' toast", async () => {
    const logoutRoute = await import("~/routes/logout");
    const res = await logoutRoute.action({
      request: new Request("http://localhost/logout", { method: "POST" }),
    } as Parameters<typeof logoutRoute.action>[0]);
    expect((res as Response).headers.get("Location")).toBe("/login");
    expect(await flashKeyOf(res)).toBe("signedOut");
  });
});
