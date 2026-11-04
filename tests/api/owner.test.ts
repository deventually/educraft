import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Settings = typeof import("~/server/repositories/settings.server");
type Auth = typeof import("~/server/auth.server");
type Users = typeof import("~/server/repositories/users.server");
let settings: Settings;
let auth: Auth;
let users: Users;

beforeAll(async () => {
  [settings, auth, users] = await Promise.all([
    import("~/server/repositories/settings.server"),
    import("~/server/auth.server"),
    import("~/server/repositories/users.server"),
  ]);
});

const asUser = (id: string, role: "teacher" | "admin") => ({ id, role });

describe("owner (super admin) setting (P18.6)", () => {
  it("unset = no owner", async () => {
    expect(await settings.getOwnerUserId()).toBeNull();
    expect(await auth.isOwner(asUser("whoever", "admin"))).toBe(false);
  });

  it("round-trips the owner id and clears it with null", async () => {
    await settings.setOwnerUserId("owner-1");
    expect(await settings.getOwnerUserId()).toBe("owner-1");
    await settings.setOwnerUserId("owner-2"); // upsert, not a second row
    expect(await settings.getOwnerUserId()).toBe("owner-2");
    await settings.setOwnerUserId(null);
    expect(await settings.getOwnerUserId()).toBeNull();
  });

  it("isOwner is true only for the admin whose id is stored", async () => {
    await settings.setOwnerUserId("owner-1");
    expect(await auth.isOwner(asUser("owner-1", "admin"))).toBe(true);
    expect(await auth.isOwner(asUser("other-admin", "admin"))).toBe(false);
  });

  it("a stored id of a teacher or a deleted user is no owner", async () => {
    const t = await users.createUser({
      id: "was-owner",
      name: "Demoted",
      passwordHash: "scrypt:x:y",
      role: "admin",
    });
    await settings.setOwnerUserId(t.id);
    expect(await auth.isOwner(asUser(t.id, "admin"))).toBe(true);
    // Demoted: the session resolves the role fresh, so the user is now a teacher.
    await users.setUserRole(t.id, "teacher");
    const demoted = await users.getUserById(t.id);
    expect(await auth.isOwner(asUser(t.id, demoted!.role as "teacher"))).toBe(false);
    // Deleted: nobody can act as that id any more, and a teacher claiming it is no owner.
    await users.deleteUserCascade(t.id);
    expect(await auth.isOwner(asUser(t.id, "teacher"))).toBe(false);
  });

  it("a garbage stored value counts as no owner", async () => {
    const { getDb } = await import("~/server/db.server");
    const { instanceSettings } = await import("~/server/schema.server");
    getDb()
      .insert(instanceSettings)
      .values({ key: "ownerUserId", valueJson: "{not json", updatedAt: new Date() })
      .onConflictDoUpdate({ target: instanceSettings.key, set: { valueJson: "{not json" } })
      .run();
    expect(await settings.getOwnerUserId()).toBeNull();
    expect(await auth.isOwner(asUser("owner-1", "admin"))).toBe(false);
  });
});
