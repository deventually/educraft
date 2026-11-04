import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/profiles.server");
let repo: Repo;

const USER_A = "user-aaaa";
const USER_B = "user-bbbb";

beforeAll(async () => {
  repo = await import("~/server/repositories/profiles.server");
});

describe("profiles repository — per-user scoping", () => {
  it("creates and lists profiles scoped to their owner", async () => {
    await repo.createProfile(USER_A, { name: "A — SE jaar 3", domain: "ICT" });
    await repo.createProfile(USER_B, { name: "B — Verpleegkunde" });

    const aProfiles = await repo.listProfiles(USER_A);
    const bProfiles = await repo.listProfiles(USER_B);

    expect(aProfiles.map((p) => p.name)).toEqual(["A — SE jaar 3"]);
    expect(bProfiles.map((p) => p.name)).toEqual(["B — Verpleegkunde"]);
  });

  it("prevents user B from reading user A's profile", async () => {
    const created = await repo.createProfile(USER_A, { name: "Private A" });
    // A can read it…
    expect((await repo.getProfile(USER_A, created.id))?.name).toBe("Private A");
    // …but B cannot.
    expect(await repo.getProfile(USER_B, created.id)).toBeNull();
  });

  it("prevents user B from deleting user A's profile", async () => {
    const created = await repo.createProfile(USER_A, { name: "Undeletable by B" });
    // B's delete is a no-op (WHERE also matches userId).
    await repo.deleteProfile(USER_B, created.id);
    expect((await repo.getProfile(USER_A, created.id))?.name).toBe("Undeletable by B");
    // A can delete their own.
    await repo.deleteProfile(USER_A, created.id);
    expect(await repo.getProfile(USER_A, created.id)).toBeNull();
  });

  it("scopes updates and the default flag per user", async () => {
    const created = await repo.createProfile(USER_A, { name: "Editable" });
    // B cannot update A's profile.
    await repo.updateProfile(USER_B, created.id, { name: "Hacked" }, true);
    expect((await repo.getProfile(USER_A, created.id))?.name).toBe("Editable");

    // A can update and set default; the default is scoped to A.
    await repo.updateProfile(USER_A, created.id, { name: "Edited" }, true);
    expect((await repo.getProfile(USER_A, created.id))?.name).toBe("Edited");
    expect((await repo.getDefaultProfile(USER_A))?.id).toBe(created.id);
    // B's default (if any) is never A's profile.
    expect((await repo.getDefaultProfile(USER_B))?.id).not.toBe(created.id);
  });
});

describe("profiles repository — first profile becomes the default (P19.6)", () => {
  const USER_C = "user-cccc";
  const USER_D = "user-dddd";

  it("makes the first profile the default, even without the flag", async () => {
    const first = await repo.createProfile(USER_C, { name: "Eerste" }, false);
    expect((await repo.getDefaultProfile(USER_C))?.id).toBe(first.id);
  });

  it("keeps the existing default when another profile is created without the flag", async () => {
    const first = await repo.createProfile(USER_D, { name: "Eerste" }, false);
    await repo.createProfile(USER_D, { name: "Tweede" }, false);
    expect((await repo.getDefaultProfile(USER_D))?.id).toBe(first.id);
  });

  it("lets an explicit default move the default", async () => {
    const first = await repo.createProfile("user-eeee", { name: "Eerste" });
    const second = await repo.createProfile("user-eeee", { name: "Tweede" }, true);
    expect((await repo.getDefaultProfile("user-eeee"))?.id).toBe(second.id);
    expect(first.id).not.toBe(second.id);
  });
});
