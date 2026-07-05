import { describe, it, expect, beforeAll } from "vitest";

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
      role: "student",
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
      passwordHash: password.hashPassword("old-password-x"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);

    const res = await invoke(
      reset.token,
      post({ password: "brand-new-secret", confirm: "brand-new-secret" }),
    );
    // A successful reset logs the user in (redirect Response), not a JSON error.
    expect(res instanceof Response).toBe(true);

    const after = await users.getUserById(u.id);
    expect(password.verifyPassword("brand-new-secret", after!.passwordHash)).toBe(true);
    // Token is single-use — spent by the reset.
    expect(await users.getPasswordReset(reset.token)).toBeNull();
  });

  it("rejects a too-short password and leaves the account unchanged", async () => {
    const u = await users.createUser({
      name: "Short Pw",
      email: "shortpw@example.com",
      passwordHash: password.hashPassword("keep-this-one"),
      role: "teacher",
    });
    const reset = await users.createPasswordReset(u.id);
    const res = (await invoke(reset.token, post({ password: "short", confirm: "short" }))) as {
      error?: string;
    };
    expect(res.error).toBeTruthy();
    // Unchanged and the token is still redeemable.
    const after = await users.getUserById(u.id);
    expect(password.verifyPassword("keep-this-one", after!.passwordHash)).toBe(true);
    expect(await users.getPasswordReset(reset.token)).not.toBeNull();
  });
});
