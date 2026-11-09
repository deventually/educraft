import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Users = typeof import("~/server/repositories/users.server");
type Login = typeof import("~/routes/login");
type Login2fa = typeof import("~/routes/login.2fa");
type Password = typeof import("~/server/password.server");
type Repo = typeof import("~/server/repositories/twoFactor.server");
type Totp = typeof import("~/server/totp.server");
type Audit = typeof import("~/server/repositories/auditLog.server");
type Auth = typeof import("~/server/auth.server");
type I18n = typeof import("~/lib/i18n");
let users: Users;
let login: Login;
let login2fa: Login2fa;
let password: Password;
let repo: Repo;
let totp: Totp;
let audit: Audit;
let auth: Auth;
let i18n: I18n;

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  login = await import("~/routes/login");
  login2fa = await import("~/routes/login.2fa");
  password = await import("~/server/password.server");
  repo = await import("~/server/repositories/twoFactor.server");
  totp = await import("~/server/totp.server");
  audit = await import("~/server/repositories/auditLog.server");
  auth = await import("~/server/auth.server");
  i18n = await import("~/lib/i18n");
});

const PW = "correct-horse-battery";
let n = 0;

async function makeUser(withTwoFactor: boolean) {
  n++;
  const email = `twee${n}@school.nl`;
  const user = await users.createUser({
    name: `T${n}`,
    email,
    role: "teacher",
    passwordHash: await password.hashPassword(PW),
  });
  if (!withTwoFactor) return { user, email, secret: "", codes: [] as string[] };
  const secret = (await repo.startTwoFactorSetup(user.id))!;
  const step = Math.floor(Date.now() / 30_000);
  const codes = (await repo.confirmTwoFactorSetup(user.id, totp.totpCode(secret, step - 1)))!;
  return { user, email, secret, codes };
}

async function passwordStep(email: string) {
  const fd = new FormData();
  fd.set("email", email);
  fd.set("password", PW);
  const request = new Request("http://localhost/login", { method: "POST", body: fd });
  return (await login.action({ request, params: {}, context: {} } as never)) as Response;
}

function cookiesOf(res: Response): string[] {
  return res.headers.getSetCookie().map((c) => c.split(";")[0]!);
}

async function codeStep(cookie: string, code: string) {
  const fd = new FormData();
  fd.set("code", code);
  const request = new Request("http://localhost/login/2fa", {
    method: "POST",
    body: fd,
    headers: { Cookie: cookie },
  });
  return login2fa.action({ request, params: {}, context: {} } as never);
}

const errorOf = (res: unknown) =>
  res instanceof Response ? undefined : (res as { error?: string }).error;
const nowCode = (secret: string) => totp.totpCode(secret, Math.floor(Date.now() / 30_000));

describe("login with two-step verification (P2-12)", () => {
  it("without it, the password alone signs in, as before", async () => {
    const { email } = await makeUser(false);
    const res = await passwordStep(email);
    expect(res.headers.get("Location")).toBe("/");
    expect(cookiesOf(res).some((c) => c.startsWith("__session="))).toBe(true);
  });

  it("with it, the right password leads to the code step without a session", async () => {
    const { email } = await makeUser(true);
    const res = await passwordStep(email);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login/2fa");
    const cookies = cookiesOf(res);
    expect(cookies.some((c) => c.startsWith("__session="))).toBe(false);
    expect(cookies.some((c) => c.startsWith("__2fa="))).toBe(true);
  });

  it("the right app code then signs in and ends the pending step", async () => {
    const { user, email, secret } = await makeUser(true);
    const pending = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    const res = (await codeStep(pending, nowCode(secret))) as Response;
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get("Location")).toBe("/");
    const set = res.headers.getSetCookie();
    const session = set.find((c) => c.startsWith("__session="))!.split(";")[0]!;
    expect(
      set.some(
        (c) =>
          c.startsWith("__2fa=;") || /^__2fa=[^;]*;.*(Max-Age=0|Expires=Thu, 01 Jan 1970)/.test(c),
      ),
    ).toBe(true);
    const signedIn = await auth.getUser(
      new Request("http://localhost/", { headers: { Cookie: session } }),
    );
    expect(signedIn?.id).toBe(user.id);
  });

  it("a wrong code gets a message and no session", async () => {
    const { email } = await makeUser(true);
    const pending = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    expect(errorOf(await codeStep(pending, "000000"))).toBe(
      i18n.getMessages("nl").twoFactor.loginWrong,
    );
  });

  it("a recovery code signs in once and lands in the audit log", async () => {
    const { user, email, codes } = await makeUser(true);
    const pending = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    expect(await codeStep(pending, codes[0]!)).toBeInstanceOf(Response);
    const again = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    expect(errorOf(await codeStep(again, codes[0]!))).toBeDefined();
    const log = await audit.listAdminActions();
    expect(log.some((e) => e.action === "twoFactorRecoveryUsed" && e.actorUserId === user.id)).toBe(
      true,
    );
  });

  it("without a pending step the code step sends you back to /login", async () => {
    const res = (await codeStep("", "123456")) as Response;
    expect(res.headers.get("Location")).toBe("/login");
    const loader = await login2fa.loader({
      request: new Request("http://localhost/login/2fa"),
      params: {},
      context: {},
    } as never);
    expect((loader as Response).headers.get("Location")).toBe("/login");
  });

  it("locks the code step after 5 wrong codes, even for the right one", async () => {
    const { email, secret } = await makeUser(true);
    const pending = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    for (let i = 0; i < 5; i++) await codeStep(pending, "000000");
    const res = await codeStep(pending, nowCode(secret));
    expect(errorOf(res)).toBe(
      i18n.getMessages("nl").auth.tooManyAttempts.replace("{minutes}", "15"),
    );
  });

  it("a deactivated account does not get in at the code step", async () => {
    const { user, email, secret } = await makeUser(true);
    const pending = cookiesOf(await passwordStep(email)).find((c) => c.startsWith("__2fa="))!;
    await users.setUserDisabled(user.id, true);
    const res = (await codeStep(pending, nowCode(secret))) as Response;
    expect(res.headers.get("Location")).toBe("/login");
  });
});
