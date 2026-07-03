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

  it("allows a nameless (email-less) invite-based account", async () => {
    const created = await repo.createUser({
      name: "Anon",
      passwordHash: "scrypt:aa:bb",
      role: "student",
    });
    const byId = await repo.getUserById(created.id);
    expect(byId?.email ?? null).toBeNull();
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
    const invite = await repo.createInvite({ role: "student" });
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
      role: "student",
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await repo.consumeInvite(invite.token, "user-c")).toBeNull();
    // And it was never marked used.
    expect((await repo.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();
  });

  it("returns null when consuming an unknown token", async () => {
    expect(await repo.consumeInvite("does-not-exist", "user-x")).toBeNull();
  });
});
