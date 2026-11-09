import { describe, it, expect, beforeAll } from "vitest";
import { flashKeyOf } from "../helpers/flash";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Users = typeof import("~/server/repositories/users.server");
type ResetRoute = typeof import("~/routes/reset.$token");
type Password = typeof import("~/server/password.server");

let users: Users;
let resetRoute: ResetRoute;
let password: Password;

beforeAll(async () => {
  [users, resetRoute, password] = await Promise.all([
    import("~/server/repositories/users.server"),
    import("~/routes/reset.$token"),
    import("~/server/password.server"),
  ]);
});

function post(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields);
  return new Request("http://localhost/reset/tok", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

const invoke = (token: string, request: Request) =>
  resetRoute.action({ request, params: { token }, context: {} } as never);

describe("password reset repository", () => {
  it("mints, fetches, and single-use-consumes a reset token", async () => {
    const u = await users.createUser({
      name: "Reset Me",
      email: "reset@example.com",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);
    expect(reset.token.length).toBeGreaterThanOrEqual(32);
    expect((await users.getPasswordReset(reset.token))?.userId).toBe(u.id);

    // Consuming returns the row and deletes it — a replay is rejected.
    expect((await users.consumePasswordReset(reset.token))?.userId).toBe(u.id);
    expect(await users.consumePasswordReset(reset.token)).toBeNull();
    expect(await users.getPasswordReset(reset.token)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const u = await users.createUser({
      name: "Expired",
      passwordHash: "scrypt:a:b",
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id, -1); // already expired
    expect(await users.consumePasswordReset(reset.token)).toBeNull();
  });
});

describe("reset route action", () => {
  it("sets the new password, consuming the token (user can log in with it after)", async () => {
    const u = await users.createUser({
      name: "New Pw",
      email: "newpw@example.com",
      passwordHash: await password.hashPassword("old-password-x"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);

    const res = await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    // A successful reset logs the user in (redirect Response), not a JSON error.
    expect(res instanceof Response).toBe(true);
    // P16: the landing page confirms the new password with a toast.
    expect(await flashKeyOf(res)).toBe("passwordReset");

    const after = await users.getUserById(u.id);
    expect(await password.verifyPassword("brand-new-secret", after!.passwordHash)).toBe(true);
    // Token is single-use — spent by the reset.
    expect(await users.getPasswordReset(reset.token)).toBeNull();
  });

  it("rejects a too-short password and leaves the account unchanged", async () => {
    const u = await users.createUser({
      name: "Short Pw",
      email: "shortpw@example.com",
      passwordHash: await password.hashPassword("keep-this-one"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);
    const res = (await invoke(reset.token, post({ password: "short", confirm: "short" }))) as {
      error?: string;
    };
    expect(res.error).toBeTruthy();
    // Unchanged and the token is still redeemable.
    const after = await users.getUserById(u.id);
    expect(await password.verifyPassword("keep-this-one", after!.passwordHash)).toBe(true);
    expect(await users.getPasswordReset(reset.token)).not.toBeNull();
  });

  it("rejects a commonly used password and leaves the account unchanged", async () => {
    const u = await users.createUser({
      name: "Common Pw",
      email: "commonpw@example.com",
      passwordHash: await password.hashPassword("keep-this-one"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);
    const res = (await invoke(
      reset.token,
      post({ password: "Welkom2026!", confirm: "Welkom2026!" }),
    )) as { error?: string };
    expect(res.error).toMatch(/veelgebruikt|commonly used/);
    const after = await users.getUserById(u.id);
    expect(await password.verifyPassword("keep-this-one", after!.passwordHash)).toBe(true);
    expect(await users.getPasswordReset(reset.token)).not.toBeNull();
  });

  it("logs out an older session of the same user, and keeps the new one valid", async () => {
    const auth = await import("~/server/auth.server");
    const u = await users.createUser({
      name: "Stale Cookie",
      email: "stale@example.com",
      passwordHash: await password.hashPassword("old-password-x"),
      role: "teacher",
    });
    const cookieOf = async (res: Response) => (res.headers.get("Set-Cookie") ?? "").split(";")[0]!;
    const asRequest = (cookie: string) =>
      new Request("http://localhost/", { headers: { Cookie: cookie } });

    const older = await cookieOf(await auth.createUserSession(u.id, "/"));
    expect((await auth.getUser(asRequest(older!)))?.id).toBe(u.id);

    const reset = await users.createPasswordReset(u.id);
    const res = (await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    )) as Response;
    const fresh = await cookieOf(res);

    expect(await auth.getUser(asRequest(older!))).toBeNull();
    expect((await auth.getUser(asRequest(fresh!)))?.id).toBe(u.id);
  });
});

describe("reset link of a deactivated account (P18.7)", () => {
  it("deactivating voids the account's open links; reactivating does not bring them back", async () => {
    const u = await users.createUser({
      name: "Dark Void",
      email: "darkvoid@example.com",
      passwordHash: await password.hashPassword("old-password-x"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);
    await users.setUserDisabled(u.id, true);
    expect(await users.getPasswordReset(reset.token)).toBeNull();
    await users.setUserDisabled(u.id, false);
    const res = await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    expect(res instanceof Response).toBe(false);
  });

  it("a link minted while deactivated does not let the user in, and is not spent", async () => {
    const auth = await import("~/server/auth.server");
    const u = await users.createUser({
      name: "Dark Reset",
      email: "darkreset@example.com",
      passwordHash: await password.hashPassword("old-password-x"),
      role: "teacher",
    });
    await users.setUserDisabled(u.id, true);
    // e.g. a regular admin's reset link for a deactivated teacher
    const reset = await users.createPasswordReset(u.id);

    // The page says the link is invalid ...
    const loaded = (await resetRoute.loader({
      params: { token: reset.token },
      request: new Request("http://localhost/reset/x"),
      context: {},
    } as never)) as { valid: boolean };
    expect(loaded.valid).toBe(false);

    // ... and posting a new password neither changes it nor starts a session.
    const res = await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    expect(res instanceof Response).toBe(false);
    expect((res as { error?: string }).error).toBeTruthy();
    const after = await users.getUserById(u.id);
    expect(await password.verifyPassword("old-password-x", after!.passwordHash)).toBe(true);
    expect(await password.verifyPassword("brand-new-secret", after!.passwordHash)).toBe(false);
    expect(await users.getPasswordReset(reset.token)).not.toBeNull(); // not consumed

    // After reactivation that link works.
    await users.setUserDisabled(u.id, false);
    const ok = await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    expect(ok instanceof Response).toBe(true);
    const cookie = ((ok as Response).headers.get("Set-Cookie") ?? "").split(";")[0]!;
    expect(
      (await auth.getUser(new Request("http://localhost/", { headers: { Cookie: cookie } })))?.id,
    ).toBe(u.id);
  });
});

describe("a new password voids the other open links (P18.7 review)", () => {
  it("redeeming one link kills the user's other open links", async () => {
    const u = await users.createUser({
      name: "Two Links",
      email: "twolinks@example.com",
      passwordHash: await password.hashPassword("old-password-x"),
      role: "teacher",
    });
    const first = await users.createPasswordReset(u.id);
    const second = await users.createPasswordReset(u.id);
    const res = await invoke(
      first.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    expect(res instanceof Response).toBe(true);
    expect(await users.getPasswordReset(second.token)).toBeNull();
  });

  it("updateUserPassword voids every open link of that user only", async () => {
    const a = await users.createUser({ name: "PwA", passwordHash: "scrypt:a:b", role: "teacher" });
    const b = await users.createUser({ name: "PwB", passwordHash: "scrypt:a:b", role: "teacher" });
    const la = await users.createPasswordReset(a.id);
    const lb = await users.createPasswordReset(b.id);
    await users.updateUserPassword(a.id, await password.hashPassword("another-secret"));
    expect(await users.getPasswordReset(la.token)).toBeNull();
    expect(await users.getPasswordReset(lb.token)).not.toBeNull();
  });
});
