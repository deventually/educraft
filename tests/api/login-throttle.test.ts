import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Users = typeof import("~/server/repositories/users.server");
type Login = typeof import("~/routes/login");
type Password = typeof import("~/server/password.server");
type I18n = typeof import("~/lib/i18n");
let users: Users;
let login: Login;
let password: Password;
let i18n: I18n;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  login = await import("~/routes/login");
  password = await import("~/server/password.server");
  i18n = await import("~/lib/i18n");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const PW = "correct-horse-battery";

async function makeUser(email: string) {
  return users.createUser({
    name: "T",
    email,
    role: "teacher",
    passwordHash: await password.hashPassword(PW),
  });
}

function attempt(email: string, pw: string, headers: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", pw);
  const request = new Request("http://localhost/login", { method: "POST", body: fd, headers });
  return login.action({ request, params: {}, context: {} } as never);
}

function errorOf(res: unknown): string | undefined {
  return res instanceof Response ? undefined : (res as { error?: string }).error;
}

describe("login throttling", () => {
  it("locks an address after 5 wrong passwords, even for the right one", async () => {
    const m = i18n.getMessages("nl");
    await makeUser("lock@school.nl");
    for (let i = 0; i < 5; i++) {
      expect(errorOf(await attempt("lock@school.nl", "wrong-password"))).toBe(m.auth.loginFailed);
    }
    const locked = errorOf(await attempt("lock@school.nl", PW));
    expect(locked).toBe(m.auth.tooManyAttempts.replace("{minutes}", "15"));
  });

  it("does not lock another address", async () => {
    await makeUser("other@school.nl");
    for (let i = 0; i < 5; i++) await attempt("victim@school.nl", "wrong-password");
    expect(await attempt("other@school.nl", PW)).toBeInstanceOf(Response);
  });

  it("locks an unknown address the same way, so it reveals nothing", async () => {
    const m = i18n.getMessages("nl");
    for (let i = 0; i < 5; i++) await attempt("nobody@school.nl", "wrong-password");
    expect(errorOf(await attempt("nobody@school.nl", "wrong-password"))).toBe(
      m.auth.tooManyAttempts.replace("{minutes}", "15"),
    );
  });

  it("a successful login clears the failures", async () => {
    await makeUser("clear@school.nl");
    for (let i = 0; i < 4; i++) await attempt("clear@school.nl", "wrong-password");
    expect(await attempt("clear@school.nl", PW)).toBeInstanceOf(Response);
    for (let i = 0; i < 4; i++) await attempt("clear@school.nl", "wrong-password");
    expect(await attempt("clear@school.nl", PW)).toBeInstanceOf(Response);
  });

  it("opens again after the lockout", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await makeUser("later@school.nl");
    for (let i = 0; i < 5; i++) await attempt("later@school.nl", "wrong-password");
    vi.setSystemTime(Date.now() + 15 * 60_000);
    expect(await attempt("later@school.nl", PW)).toBeInstanceOf(Response);
  });

  it("with CLIENT_IP_HEADER set, one address may guess across accounts only up to a higher cap", async () => {
    vi.stubEnv("CLIENT_IP_HEADER", "x-real-ip");
    const m = i18n.getMessages("nl");
    const ip = { "x-real-ip": "203.0.113.7" };
    await makeUser("school-nat@school.nl");
    // A whole school behind one IP: a few typos on different accounts lock nobody out.
    for (let i = 0; i < 10; i++) await attempt(`typo${i}@school.nl`, "wrong-password", ip);
    expect(await attempt("school-nat@school.nl", PW, ip)).toBeInstanceOf(Response);
    // Spraying many accounts from one IP hits the IP cap.
    for (let i = 0; i < 30; i++) await attempt(`spray${i}@school.nl`, "wrong-password", ip);
    expect(errorOf(await attempt("school-nat@school.nl", PW, ip))).toBe(
      m.auth.tooManyAttempts.replace("{minutes}", "15"),
    );
    // Another IP is not affected.
    expect(
      await attempt("school-nat@school.nl", PW, { "x-real-ip": "198.51.100.1" }),
    ).toBeInstanceOf(Response);
  });

  it("locks for 30 minutes after a second round of 5 wrong passwords", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const m = i18n.getMessages("nl");
    await makeUser("again@school.nl");
    for (let i = 0; i < 5; i++) await attempt("again@school.nl", "wrong-password");
    vi.setSystemTime(Date.now() + 15 * 60_000);
    for (let i = 0; i < 5; i++) await attempt("again@school.nl", "wrong-password");
    expect(errorOf(await attempt("again@school.nl", PW))).toBe(
      m.auth.tooManyAttempts.replace("{minutes}", "30"),
    );
  });

  it("says hours, not minutes, once the lockout is longer than an hour", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const m = i18n.getMessages("nl");
    await makeUser("hours@school.nl");
    for (const wait of [15, 30, 60]) {
      for (let i = 0; i < 5; i++) await attempt("hours@school.nl", "wrong-password");
      vi.setSystemTime(Date.now() + wait * 60_000);
    }
    for (let i = 0; i < 5; i++) await attempt("hours@school.nl", "wrong-password");
    expect(errorOf(await attempt("hours@school.nl", PW))).toBe(
      m.auth.tooManyAttemptsHours.replace("{hours}", "2"),
    );
  });
});
