import { beforeAll, describe, expect, it } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");
type Repo = typeof import("~/server/repositories/twoFactor.server");
type Totp = typeof import("~/server/totp.server");
let auth: Auth;
let users: Users;
let repo: Repo;
let totp: Totp;

beforeAll(async () => {
  auth = await import("~/server/auth.server");
  users = await import("~/server/repositories/users.server");
  repo = await import("~/server/repositories/twoFactor.server");
  totp = await import("~/server/totp.server");
});

let n = 0;
async function signedIn(role: "teacher" | "admin", withTwoFactor: boolean) {
  n++;
  const user = await users.createUser({ name: `R${n}`, passwordHash: "x", role });
  if (withTwoFactor) {
    const secret = (await repo.startTwoFactorSetup(user.id))!;
    await repo.confirmTwoFactorSetup(
      user.id,
      totp.totpCode(secret, Math.floor(Date.now() / 30_000)),
    );
  }
  const res = await auth.createUserSession(user.id, "/");
  const cookie = res.headers.get("Set-Cookie")!.split(";")[0]!;
  return new Request("http://localhost/admin", { headers: { Cookie: cookie } });
}

async function thrown(p: Promise<unknown>): Promise<Response | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e as Response;
  }
}

describe("two-step verification is required for admins (P2-12)", () => {
  it("an admin without it is sent to set it up before any admin page", async () => {
    const res = await thrown(auth.requireRole(await signedIn("admin", false), "admin"));
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("/account/2fa");
  });

  it("an admin with it gets in", async () => {
    const user = await auth.requireRole(await signedIn("admin", true), "admin");
    expect(user.role).toBe("admin");
  });

  it("pages for teachers and admins alike stay open to an admin without it", async () => {
    const user = await auth.requireRole(await signedIn("admin", false), "teacher", "admin");
    expect(user.role).toBe("admin");
  });

  it("a teacher never needs it", async () => {
    const user = await auth.requireRole(await signedIn("teacher", false), "teacher");
    expect(user.role).toBe("teacher");
  });
});
