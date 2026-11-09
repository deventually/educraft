import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Session = typeof import("~/server/session.server");
type Users = typeof import("~/server/repositories/users.server");
let auth: Auth;
let session: Session;
let users: Users;

beforeAll(async () => {
  [auth, session, users] = await Promise.all([
    import("~/server/auth.server"),
    import("~/server/session.server"),
    import("~/server/repositories/users.server"),
  ]);
});

afterEach(() => {
  vi.useRealTimers();
});

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-11-09T08:00:00Z");

let n = 0;
async function newUser() {
  n += 1;
  return users.createUser({
    id: `idle-${n}`,
    name: `Idle ${n}`,
    passwordHash: "scrypt:x:y",
    role: "teacher",
  });
}

/** The `__session=…` pair from a response's Set-Cookie headers, or null. */
function sessionPair(headers: Headers): string | null {
  const line = headers.getSetCookie().find((c) => c.startsWith("__session="));
  return line ? line.split(";")[0]! : null;
}

async function loginCookie(userId: string): Promise<string> {
  const res = await auth.createUserSession(userId, "/");
  const pair = sessionPair(res.headers);
  expect(pair).not.toBeNull();
  return pair as string;
}

const withCookie = (cookie?: string | null) =>
  new Request("http://localhost/", { headers: cookie ? { Cookie: cookie } : {} });

function middlewareArgs(request: Request) {
  return { request, params: {}, context: {} } as unknown as Parameters<
    Session["sessionRefreshMiddleware"]
  >[0];
}

describe("session idle timeout (8 hours)", () => {
  it("is 8 hours, and the cookie itself expires after 8 hours", async () => {
    expect(session.SESSION_IDLE_MS).toBe(8 * HOUR);
    const u = await newUser();
    const res = await auth.createUserSession(u.id, "/");
    const line = res.headers.getSetCookie().find((c) => c.startsWith("__session=")) ?? "";
    expect(line).toMatch(/Max-Age=28800/);
  });

  it("keeps a session that was active less than 8 hours ago", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 7 * HOUR + 59 * 60 * 1000));
    expect((await auth.getUser(withCookie(cookie)))?.id).toBe(u.id);
  });

  it("logs a session out after 8 hours without activity", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 8 * HOUR + 1000));
    expect(await auth.getUser(withCookie(cookie))).toBeNull();
  });

  it("treats a cookie without a last-seen time (minted before this change) as logged out", async () => {
    const u = await newUser();
    const s = await session.getSession();
    s.set("userId", u.id);
    s.set("sessionVersion", 0);
    const cookie = (await session.commitSession(s)).split(";")[0];
    expect(await auth.getUser(withCookie(cookie))).toBeNull();
  });
});

describe("sessionRefreshMiddleware (sliding timeout)", () => {
  it("is the root route's middleware, so every request counts as activity", async () => {
    const root = await import("~/root");
    expect(root.middleware).toContain(session.sessionRefreshMiddleware);
  });

  it("refreshes an active session, so 8 hours count from the last request", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);

    // Six hours later the teacher is still working: the cookie is refreshed …
    vi.setSystemTime(new Date(T0.getTime() + 6 * HOUR));
    const res = (await session.sessionRefreshMiddleware(
      middlewareArgs(withCookie(cookie)),
      async () => new Response("ok"),
    )) as Response;
    const refreshed = sessionPair(res.headers);
    expect(refreshed).not.toBeNull();

    // … so another six hours on (12 since login) the refreshed cookie still works,
    vi.setSystemTime(new Date(T0.getTime() + 12 * HOUR));
    expect((await auth.getUser(withCookie(refreshed)))?.id).toBe(u.id);
    // while the old one has expired.
    expect(await auth.getUser(withCookie(cookie))).toBeNull();
  });

  it("does not revive an expired session", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 9 * HOUR));
    const res = (await session.sessionRefreshMiddleware(
      middlewareArgs(withCookie(cookie)),
      async () => new Response("ok"),
    )) as Response;
    expect(sessionPair(res.headers)).toBeNull();
  });

  it("leaves a request without a session alone", async () => {
    const res = (await session.sessionRefreshMiddleware(
      middlewareArgs(withCookie()),
      async () => new Response("ok"),
    )) as Response;
    expect(sessionPair(res.headers)).toBeNull();
  });

  it("does not refresh again within a few minutes (no Set-Cookie on every request)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 60 * 1000));
    const res = (await session.sessionRefreshMiddleware(
      middlewareArgs(withCookie(cookie)),
      async () => new Response("ok"),
    )) as Response;
    expect(sessionPair(res.headers)).toBeNull();
  });

  it("never overrides a session cookie the route itself sets (logout, login, new password)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 2 * HOUR));
    const res = (await session.sessionRefreshMiddleware(middlewareArgs(withCookie(cookie)), () =>
      auth.logout(withCookie(cookie)),
    )) as Response;
    const lines = res.headers.getSetCookie().filter((c) => c.startsWith("__session="));
    expect(lines).toHaveLength(1);
    expect(await auth.getUser(withCookie(sessionPair(res.headers)))).toBeNull();
  });

  it("also refreshes on a redirect (immutable headers)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    const u = await newUser();
    const cookie = await loginCookie(u.id);
    vi.setSystemTime(new Date(T0.getTime() + 2 * HOUR));
    const res = (await session.sessionRefreshMiddleware(
      middlewareArgs(withCookie(cookie)),
      async () => Response.redirect("http://localhost/home", 302),
    )) as Response;
    expect(res.status).toBe(302);
    expect(sessionPair(res.headers)).not.toBeNull();
  });
});
