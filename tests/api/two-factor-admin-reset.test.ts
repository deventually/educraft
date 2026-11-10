import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let users: typeof import("~/server/repositories/users.server");
let settings: typeof import("~/server/repositories/settings.server");
let audit: typeof import("~/server/repositories/auditLog.server");
let repo: typeof import("~/server/repositories/twoFactor.server");
let totp: typeof import("~/server/totp.server");
let person: typeof import("~/routes/admin.users.$id");

beforeAll(async () => {
  users = await import("~/server/repositories/users.server");
  settings = await import("~/server/repositories/settings.server");
  audit = await import("~/server/repositories/auditLog.server");
  repo = await import("~/server/repositories/twoFactor.server");
  totp = await import("~/server/totp.server");
  person = await import("~/routes/admin.users.$id");
});

let n = 0;
async function mk(role: "teacher" | "admin", withTwoFactor = true) {
  n++;
  const u = await users.createUser({ name: `P${n}`, passwordHash: "x", role });
  if (withTwoFactor) {
    const secret = (await repo.startTwoFactorSetup(u.id))!;
    await repo.confirmTwoFactorSetup(u.id, totp.totpCode(secret, Math.floor(Date.now() / 30_000)));
  }
  return u;
}

function onPerson(id: string, intent: string) {
  const request = signedRequest("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ intent }).toString(),
  });
  return person.action({ request, params: { id }, context: {} } as never) as Promise<
    Record<string, unknown>
  >;
}
const load = (id: string) =>
  person.loader({
    request: signedRequest("http://localhost/x"),
    params: { id },
    context: {},
  } as never);

let owner: Awaited<ReturnType<typeof mk>>;
beforeEach(async () => {
  owner ??= await mk("admin");
  await settings.setOwnerUserId(owner.id);
  await signInAs({ id: owner.id });
});

describe("the owner turns off someone's two-step verification (P2-12)", () => {
  it("the person page shows whether it is on", async () => {
    const on = await mk("teacher");
    const off = await mk("teacher", false);
    expect((await load(on.id)).person.twoFactor).toBe(true);
    expect((await load(off.id)).person.twoFactor).toBe(false);
  });

  it("for a teacher or an admin, with a line in the audit log", async () => {
    for (const role of ["teacher", "admin"] as const) {
      const target = await mk(role);
      expect(await onPerson(target.id, "resetTwoFactor")).toEqual({ twoFactorReset: true });
      expect(await repo.isTwoFactorEnabled(target.id)).toBe(false);
      const [entry] = await audit.listAdminActions();
      expect(entry).toMatchObject({
        action: "twoFactorReset",
        actorUserId: owner.id,
        targetUserId: target.id,
      });
    }
  });

  it("a regular admin may not, not even for a teacher", async () => {
    const admin = await mk("admin");
    const target = await mk("teacher");
    await signInAs({ id: admin.id });
    expect(await onPerson(target.id, "resetTwoFactor")).toEqual({ error: "ownerOnly" });
    expect(await repo.isTwoFactorEnabled(target.id)).toBe(true);
  });

  it("never for the owner themself (that goes via the server)", async () => {
    expect(await onPerson(owner.id, "resetTwoFactor")).toEqual({ error: "selfTwoFactor" });
    expect(await repo.isTwoFactorEnabled(owner.id)).toBe(true);
  });
});
