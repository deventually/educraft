import { describe, it, expect, beforeAll } from "vitest";

// Point the DB at an isolated in-memory SQLite before any server module loads,
// so the repository under test never touches the on-disk dev database.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/users.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/users.server");
});

describe("users repository", () => {
  it("creates a user and fetches it back by id and email", async () => {
    const created = await repo.createUser({
      name: "Jan de Vries",
      email: "jan@example.com",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    expect(created.id).toBeTruthy();
    expect(created.role).toBe("teacher");

    const byId = await repo.getUserById(created.id);
    expect(byId?.email).toBe("jan@example.com");

    const byEmail = await repo.getUserByEmail("jan@example.com");
    expect(byEmail?.id).toBe(created.id);
  });

  it("returns null for an unknown user", async () => {
    expect(await repo.getUserById("nope")).toBeNull();
    expect(await repo.getUserByEmail("nobody@example.com")).toBeNull();
  });

  it("round-trips a per-teacher model assignment and clears with null/[] (P13)", async () => {
    // Default-open: an unset teacher inherits the instance model set (intersect).
    expect(await repo.getUserAssignedModels("mdl-anyone")).toBeNull();

    await repo.setUserAssignedModels("mdl-t", ["claude-haiku-4-5", "claude-sonnet-4-6"]);
    expect([...(await repo.getUserAssignedModels("mdl-t"))!].sort()).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
    ]);
    // Keyed per user — an unrelated teacher stays unrestricted.
    expect(await repo.getUserAssignedModels("mdl-other")).toBeNull();

    await repo.setUserAssignedModels("mdl-t", null);
    expect(await repo.getUserAssignedModels("mdl-t")).toBeNull();
    await repo.setUserAssignedModels("mdl-t", ["claude-haiku-4-5"]);
    await repo.setUserAssignedModels("mdl-t", []);
    expect(await repo.getUserAssignedModels("mdl-t")).toBeNull();
  });

  it("allows a nameless (email-less) invite-based account", async () => {
    const created = await repo.createUser({
      name: "Anon",
      passwordHash: "scrypt:aa:bb",
      role: "teacher",
    });
    const byId = await repo.getUserById(created.id);
    expect(byId?.email ?? null).toBeNull();
    // An email-less account can't be found by email → it can't log in until an
    // email is set (self-service on /account, or admin recovery).
    expect(await repo.getUserByEmail("")).toBeNull();
  });

  it("updates a user's email (with a later add) and password hash", async () => {
    const u = await repo.createUser({
      name: "Editable",
      passwordHash: "scrypt:old:hash",
      role: "teacher",
    });
    await repo.updateUserEmail(u.id, "added@example.com");
    expect((await repo.getUserById(u.id))?.email).toBe("added@example.com");
    expect((await repo.getUserByEmail("added@example.com"))?.id).toBe(u.id);

    await repo.updateUserPassword(u.id, "scrypt:new:hash");
    const after = await repo.getUserById(u.id);
    expect(after?.passwordHash).toBe("scrypt:new:hash");
    // A password change is the only thing that bumps the session version.
    expect(after?.sessionVersion).toBe(1);
  });
});

describe("invites repository", () => {
  it("mints an invite with a role and note", async () => {
    const invite = await repo.createInvite({ role: "teacher", note: "For Jan" });
    expect(invite.token.length).toBeGreaterThanOrEqual(32);
    expect(invite.role).toBe("teacher");
    expect(invite.usedByUserId).toBeNull();

    const fetched = await repo.getInvite(invite.token);
    expect(fetched?.note).toBe("For Jan");
  });

  it("consumes an invite exactly once (single-use, atomic)", async () => {
    const invite = await repo.createInvite({ role: "teacher" });
    const first = await repo.consumeInvite(invite.token, "user-a");
    expect(first?.usedByUserId).toBe("user-a");

    // A second attempt (even by a different user) is rejected.
    const second = await repo.consumeInvite(invite.token, "user-b");
    expect(second).toBeNull();

    // The stored row still records the first consumer.
    const stored = await repo.getInvite(invite.token);
    expect(stored?.usedByUserId).toBe("user-a");
  });

  it("rejects an expired invite", async () => {
    const invite = await repo.createInvite({
      role: "teacher",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await repo.consumeInvite(invite.token, "user-c")).toBeNull();
    // And it was never marked used.
    expect((await repo.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();
  });

  it("refuses retired roles at the guarded UPDATE", async () => {
    const { getDb } = await import("~/server/db.server");
    const { invites } = await import("~/server/schema.server");
    const { eq } = await import("drizzle-orm");
    const db = getDb();
    const retired = await repo.createInvite({ role: "teacher" });
    db.update(invites).set({ role: "student" }).where(eq(invites.token, retired.token)).run();
    expect(await repo.consumeInvite(retired.token, "u2")).toBeNull();
    expect((await repo.getInvite(retired.token))?.usedByUserId ?? null).toBeNull();
  });

  it("returns null when consuming an unknown token", async () => {
    expect(await repo.consumeInvite("does-not-exist", "user-x")).toBeNull();
  });
});

describe("invite provenance (P17)", () => {
  it("createInvite stores the creator", async () => {
    const invite = await repo.createInvite({ role: "teacher", createdByUserId: "admin-1" });
    const fetched = await repo.getInvite(invite.token);
    expect(fetched?.createdByUserId).toBe("admin-1");
    expect(fetched?.role).toBe("teacher");
  });
});
