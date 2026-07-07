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

  it("returns null for per-teacher country/sector assignment when unset (default-open)", async () => {
    // null = all; a teacher with no assignment is unrestricted.
    expect(await repo.getUserAssignedCountries("anyone")).toBeNull();
    expect(await repo.getUserAssignedSectors("anyone")).toBeNull();
  });

  it("round-trips a per-teacher country/sector assignment (P9 setters)", async () => {
    await repo.setUserAssignedCountries("t-assign", ["NL"]);
    await repo.setUserAssignedSectors("t-assign", ["mbo", "hbo"]);
    expect([...(await repo.getUserAssignedCountries("t-assign"))!]).toEqual(["NL"]);
    expect([...(await repo.getUserAssignedSectors("t-assign"))!].sort()).toEqual(["hbo", "mbo"]);
    // Assignments are keyed per user — an unrelated teacher stays unrestricted.
    expect(await repo.getUserAssignedSectors("t-other")).toBeNull();
  });

  it("clears a per-teacher assignment with null or an empty list", async () => {
    await repo.setUserAssignedSectors("t-clear", ["vo"]);
    await repo.setUserAssignedSectors("t-clear", null);
    expect(await repo.getUserAssignedSectors("t-clear")).toBeNull();

    await repo.setUserAssignedCountries("t-clear", ["NL"]);
    await repo.setUserAssignedCountries("t-clear", []);
    expect(await repo.getUserAssignedCountries("t-clear")).toBeNull();
  });

  it("round-trips a per-teacher domain assignment and clears with null/[] (P10.3)", async () => {
    // Default-open: an unset teacher is unrestricted.
    expect(await repo.getUserAssignedDomains("dom-anyone")).toBeNull();

    await repo.setUserAssignedDomains("dom-t", ["nt", "ICT"]);
    expect([...(await repo.getUserAssignedDomains("dom-t"))!].sort()).toEqual(["ICT", "nt"]);
    // Keyed per user — an unrelated teacher stays unrestricted.
    expect(await repo.getUserAssignedDomains("dom-other")).toBeNull();

    await repo.setUserAssignedDomains("dom-t", null);
    expect(await repo.getUserAssignedDomains("dom-t")).toBeNull();
    await repo.setUserAssignedDomains("dom-t", ["zw"]);
    await repo.setUserAssignedDomains("dom-t", []);
    expect(await repo.getUserAssignedDomains("dom-t")).toBeNull();
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

  it("round-trips the per-teacher context custom-access flag (P12)", async () => {
    // Default: a teacher is not activated → inherits the instance.
    expect(await repo.getUserContextCustomAccess("ca-anyone")).toBe(false);

    await repo.setUserContextCustomAccess("ca-t", true);
    expect(await repo.getUserContextCustomAccess("ca-t")).toBe(true);
    // Keyed per user — an unrelated teacher stays unactivated.
    expect(await repo.getUserContextCustomAccess("ca-other")).toBe(false);

    // Deactivating flips the flag back off (and is independent of any saved
    // country/sector/domain assignments, which the caller must not clear).
    await repo.setUserContextCustomAccess("ca-t", false);
    expect(await repo.getUserContextCustomAccess("ca-t")).toBe(false);
  });

  it("allows a nameless (email-less) invite-based account", async () => {
    const created = await repo.createUser({
      name: "Anon",
      passwordHash: "scrypt:aa:bb",
      role: "student",
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
    expect((await repo.getUserById(u.id))?.passwordHash).toBe("scrypt:new:hash");
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

describe("curated, identity-bound, batch invites (Phase 6)", () => {
  it("createInvite stores creator, cohort and email", async () => {
    const invite = await repo.createInvite({
      role: "student",
      createdByUserId: "teacher-1",
      cohortId: "cohort-1",
      email: "Student@School.NL",
    });
    const fetched = await repo.getInvite(invite.token);
    expect(fetched?.createdByUserId).toBe("teacher-1");
    expect(fetched?.cohortId).toBe("cohort-1");
    expect(fetched?.email).toBe("Student@School.NL");
    expect(fetched?.role).toBe("student");
  });

  it("createInvitesForCohort mints one single-use student token per recipient", async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invites = await repo.createInvitesForCohort(
      "cohort-batch",
      "teacher-2",
      [{ email: "a@example.com" }, { email: "b@example.com" }, {}],
      expiresAt,
    );
    expect(invites).toHaveLength(3);
    for (const inv of invites) {
      expect(inv.role).toBe("student");
      expect(inv.cohortId).toBe("cohort-batch");
      expect(inv.createdByUserId).toBe("teacher-2");
      expect(inv.usedByUserId).toBeNull();
      expect(inv.token.length).toBeGreaterThanOrEqual(32);
    }
    // Email is bound where given, and absent (link-only) where not.
    expect(invites[0].email).toBe("a@example.com");
    expect(invites[2].email ?? null).toBeNull();
    // Tokens are distinct.
    expect(new Set(invites.map((i) => i.token)).size).toBe(3);
  });

  it("consumeInvite requires a matching email (case-insensitive) for an identity-bound invite", async () => {
    const invite = await repo.createInvite({
      role: "student",
      cohortId: "c",
      email: "bound@example.com",
    });
    // A wrong email is rejected and the invite stays unused.
    expect(await repo.consumeInvite(invite.token, "user-wrong", "other@example.com")).toBeNull();
    expect((await repo.getInvite(invite.token))?.usedByUserId ?? null).toBeNull();

    // The matching email (any case) succeeds exactly once.
    const ok = await repo.consumeInvite(invite.token, "user-right", "BOUND@example.com");
    expect(ok?.usedByUserId).toBe("user-right");
    // Still single-use afterwards.
    expect(await repo.consumeInvite(invite.token, "user-late", "bound@example.com")).toBeNull();
  });

  it("consumeInvite ignores the submitted email for a non-bound invite", async () => {
    const invite = await repo.createInvite({ role: "student", cohortId: "c" });
    const ok = await repo.consumeInvite(invite.token, "user-any", "whatever@example.com");
    expect(ok?.usedByUserId).toBe("user-any");
  });
});
