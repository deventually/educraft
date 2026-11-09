import { beforeAll, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return { ...actual, requireUser: requireUserMock };
});

type Route = typeof import("~/routes/account.2fa");
type Users = typeof import("~/server/repositories/users.server");
type Repo = typeof import("~/server/repositories/twoFactor.server");
type Totp = typeof import("~/server/totp.server");
type Audit = typeof import("~/server/repositories/auditLog.server");
type I18n = typeof import("~/lib/i18n");
let route: Route;
let users: Users;
let repo: Repo;
let totp: Totp;
let audit: Audit;
let i18n: I18n;

beforeAll(async () => {
  route = await import("~/routes/account.2fa");
  users = await import("~/server/repositories/users.server");
  repo = await import("~/server/repositories/twoFactor.server");
  totp = await import("~/server/totp.server");
  audit = await import("~/server/repositories/auditLog.server");
  i18n = await import("~/lib/i18n");
});

let n = 0;
async function actAs(role: "teacher" | "admin") {
  n++;
  const row = await users.createUser({ name: `A${n}`, email: `a${n}@school.nl`, passwordHash: "x", role });
  requireUserMock.mockResolvedValue({ ...row, role });
  return row;
}

const step = () => Math.floor(Date.now() / 30_000);
const req = () => new Request("http://localhost/account/2fa");

function post(fields: Record<string, string>) {
  const request = new Request("http://localhost/account/2fa", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
  return route.action({ request, params: {}, context: {} } as never) as Promise<
    Record<string, unknown>
  >;
}

async function load() {
  return (await route.loader({ request: req(), params: {}, context: {} } as never)) as {
    enabled: boolean;
    required: boolean;
    recoveryLeft: number;
    setup: { secret: string; qr: string; uri: string } | null;
  };
}

const m = () => i18n.getMessages("nl").twoFactor;

describe("/account/2fa (P2-12)", () => {
  it("starts off; an admin sees it is required", async () => {
    await actAs("teacher");
    expect(await load()).toMatchObject({ enabled: false, required: false, setup: null });
    await actAs("admin");
    expect((await load()).required).toBe(true);
  });

  it("setting up shows a QR code and a key, and a right code turns it on with 10 codes", async () => {
    const me = await actAs("teacher");
    await post({ intent: "start" });
    const { setup } = await load();
    expect(setup?.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup?.qr).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(setup?.uri).toContain(`secret=${setup?.secret}`);
    expect(setup?.uri).toContain(encodeURIComponent(me.email!));

    expect((await post({ intent: "confirm", code: "000000" })).error).toBe(m().codeWrong);
    const ok = await post({ intent: "confirm", code: totp.totpCode(setup!.secret, step()) });
    expect(ok.recoveryCodes).toHaveLength(10);
    expect(await load()).toMatchObject({ enabled: true, setup: null, recoveryLeft: 10 });
    const log = await audit.listAdminActions();
    expect(log.some((e) => e.action === "twoFactorEnabled" && e.targetUserId === me.id)).toBe(true);
  });

  async function enrolledAs(role: "teacher" | "admin") {
    const me = await actAs(role);
    const secret = (await repo.startTwoFactorSetup(me.id))!;
    await repo.confirmTwoFactorSetup(me.id, totp.totpCode(secret, step() - 1));
    return { me, secret };
  }

  it("a teacher turns it off with a code; that goes in the log", async () => {
    const { me, secret } = await enrolledAs("teacher");
    expect((await post({ intent: "disable", code: "000000" })).error).toBe(m().codeWrong);
    expect(await repo.isTwoFactorEnabled(me.id)).toBe(true);
    expect((await post({ intent: "disable", code: totp.totpCode(secret, step()) })).ok).toBe(
      "disabled",
    );
    expect(await repo.isTwoFactorEnabled(me.id)).toBe(false);
    const log = await audit.listAdminActions();
    expect(log.some((e) => e.action === "twoFactorDisabled" && e.targetUserId === me.id)).toBe(true);
  });

  it("an admin cannot turn it off", async () => {
    const { me, secret } = await enrolledAs("admin");
    const res = await post({ intent: "disable", code: totp.totpCode(secret, step()) });
    expect(res.error).toBe(m().requiredCannotDisable);
    expect(await repo.isTwoFactorEnabled(me.id)).toBe(true);
  });

  it("new recovery codes need a right code", async () => {
    const { secret } = await enrolledAs("teacher");
    expect((await post({ intent: "newCodes", code: "000000" })).error).toBe(m().codeWrong);
    const res = await post({ intent: "newCodes", code: totp.totpCode(secret, step()) });
    expect(res.recoveryCodes).toHaveLength(10);
  });
});
