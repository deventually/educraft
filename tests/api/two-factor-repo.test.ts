import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/twoFactor.server");
type Users = typeof import("~/server/repositories/users.server");
type Totp = typeof import("~/server/totp.server");
let repo: Repo;
let users: Users;
let totp: Totp;

beforeAll(async () => {
  repo = await import("~/server/repositories/twoFactor.server");
  users = await import("~/server/repositories/users.server");
  totp = await import("~/server/totp.server");
});

let n = 0;
async function makeUser() {
  n++;
  return users.createUser({
    name: `U${n}`,
    email: `u${n}@school.nl`,
    passwordHash: "x",
    role: "teacher",
  });
}

/** A code for the secret that is valid right now, `offset` steps away. */
function codeNow(secret: string, offset = 0) {
  return totp.totpCode(secret, Math.floor(Date.now() / 30_000) + offset);
}

async function enrolled() {
  const user = await makeUser();
  const secret = (await repo.startTwoFactorSetup(user.id))!;
  const codes = (await repo.confirmTwoFactorSetup(user.id, codeNow(secret)))!;
  return { user, secret, codes };
}

describe("two-step verification storage (P2-12)", () => {
  it("starts off: nothing set up", async () => {
    const user = await makeUser();
    expect(await repo.getTwoFactorStatus(user.id)).toEqual({
      enabled: false,
      pendingSecret: null,
      recoveryLeft: 0,
    });
  });

  it("setup is pending until a right code confirms it, then gives 10 recovery codes", async () => {
    const user = await makeUser();
    const secret = await repo.startTwoFactorSetup(user.id);
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect((await repo.getTwoFactorStatus(user.id)).pendingSecret).toBe(secret);
    expect(await repo.isTwoFactorEnabled(user.id)).toBe(false);

    expect(await repo.confirmTwoFactorSetup(user.id, "000000")).toBeNull();
    const codes = await repo.confirmTwoFactorSetup(user.id, codeNow(secret!));
    expect(codes).toHaveLength(10);
    expect(await repo.isTwoFactorEnabled(user.id)).toBe(true);
    expect(await repo.getTwoFactorStatus(user.id)).toEqual({
      enabled: true,
      pendingSecret: null,
      recoveryLeft: 10,
    });
  });

  it("a restarted setup gets a new secret; an enabled one cannot be restarted", async () => {
    const user = await makeUser();
    const a = await repo.startTwoFactorSetup(user.id);
    const b = await repo.startTwoFactorSetup(user.id);
    expect(b).not.toBe(a);
    await repo.confirmTwoFactorSetup(user.id, codeNow(b!));
    expect(await repo.startTwoFactorSetup(user.id)).toBeNull();
  });

  it("checks an app code once (no replay), and nothing for someone without it", async () => {
    const { user, secret } = await enrolled();
    const next = codeNow(secret, 1);
    expect(await repo.verifySecondFactor(user.id, next)).toBe("app");
    expect(await repo.verifySecondFactor(user.id, next)).toBeNull();
    expect(await repo.verifySecondFactor(user.id, "123456")).toBeNull();
    const other = await makeUser();
    expect(await repo.verifySecondFactor(other.id, next)).toBeNull();
  });

  it("a recovery code works once, typed loosely, and counts down", async () => {
    const { user, codes } = await enrolled();
    const typed = codes[0]!.toUpperCase().replace("-", " ");
    expect(await repo.verifySecondFactor(user.id, typed)).toBe("recovery");
    expect(await repo.verifySecondFactor(user.id, codes[0]!)).toBeNull();
    expect((await repo.getTwoFactorStatus(user.id)).recoveryLeft).toBe(9);
  });

  it("another person's recovery code does not work", async () => {
    const a = await enrolled();
    const b = await enrolled();
    expect(await repo.verifySecondFactor(b.user.id, a.codes[1]!)).toBeNull();
  });

  it("new recovery codes replace the old ones", async () => {
    const { user, codes } = await enrolled();
    const fresh = await repo.regenerateRecoveryCodes(user.id);
    expect(fresh).toHaveLength(10);
    expect(await repo.verifySecondFactor(user.id, codes[2]!)).toBeNull();
    expect(await repo.verifySecondFactor(user.id, fresh[0]!)).toBe("recovery");
  });

  it("removing it switches it off and drops the codes; removing nothing says so", async () => {
    const { user, codes } = await enrolled();
    expect(await repo.removeTwoFactor(user.id)).toBe(true);
    expect(await repo.isTwoFactorEnabled(user.id)).toBe(false);
    expect(await repo.verifySecondFactor(user.id, codes[0]!)).toBeNull();
    expect(await repo.removeTwoFactor(user.id)).toBe(false);
  });

  it("deleting an account deletes its two-step verification", async () => {
    const { user } = await enrolled();
    await users.deleteUserCascade(user.id);
    expect(await repo.getTwoFactorStatus(user.id)).toEqual({
      enabled: false,
      pendingSecret: null,
      recoveryLeft: 0,
    });
  });
});
