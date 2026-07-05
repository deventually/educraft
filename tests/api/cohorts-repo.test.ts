import { describe, it, expect, beforeAll } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/cohorts.server");
let repo: Repo;

beforeAll(async () => {
  repo = await import("~/server/repositories/cohorts.server");
});

describe("cohorts repository", () => {
  it("creates a cohort and fetches it back, storing the allow-list + config as JSON", async () => {
    const cohort = await repo.createCohort({
      createdByUserId: "teacher-1",
      name: "SE jaar 2 — 25/26 blok 1",
      allowedToolSlugs: ["mentorai", "socratic-partner"],
      config: { mentorai: { values: { discipline: "OOP" } } },
      contextProfileId: "prof-1",
      activeUntil: null,
    });
    expect(cohort.id).toBeTruthy();
    expect(cohort.name).toBe("SE jaar 2 — 25/26 blok 1");
    // allowedToolSlugs / configJson are stored as JSON strings.
    expect(JSON.parse(cohort.allowedToolSlugs)).toEqual(["mentorai", "socratic-partner"]);
    expect(JSON.parse(cohort.configJson)).toEqual({ mentorai: { values: { discipline: "OOP" } } });
    expect(cohort.contextProfileId).toBe("prof-1");

    const fetched = await repo.getCohort(cohort.id);
    expect(fetched?.name).toBe("SE jaar 2 — 25/26 blok 1");
  });

  it("lists cohorts scoped to their owner", async () => {
    await repo.createCohort({
      createdByUserId: "owner-a",
      name: "A cohort",
      allowedToolSlugs: ["mentorai"],
    });
    await repo.createCohort({
      createdByUserId: "owner-b",
      name: "B cohort",
      allowedToolSlugs: ["mentorai"],
    });
    const a = await repo.listCohortsByOwner("owner-a");
    const b = await repo.listCohortsByOwner("owner-b");
    expect(a.map((c) => c.name)).toEqual(["A cohort"]);
    expect(b.map((c) => c.name)).toEqual(["B cohort"]);
  });

  it("updates config / allow-list / activeUntil in place", async () => {
    const cohort = await repo.createCohort({
      createdByUserId: "teacher-2",
      name: "Editable",
      allowedToolSlugs: ["mentorai"],
    });
    const until = new Date(Date.now() + 86_400_000);
    await repo.updateCohort(cohort.id, {
      allowedToolSlugs: ["mentorai", "peer-tutoring"],
      config: { "peer-tutoring": { values: { discipline: "CS" } } },
      activeUntil: until,
    });
    const updated = await repo.getCohort(cohort.id);
    expect(JSON.parse(updated!.allowedToolSlugs)).toEqual(["mentorai", "peer-tutoring"]);
    expect(JSON.parse(updated!.configJson)).toEqual({
      "peer-tutoring": { values: { discipline: "CS" } },
    });
    expect(updated!.activeUntil?.getTime()).toBe(until.getTime());
  });

  it("adds a membership (unique per (cohort,user)) and resolves the student's cohort", async () => {
    const cohort = await repo.createCohort({
      createdByUserId: "teacher-3",
      name: "With members",
      allowedToolSlugs: ["mentorai", "socratic-partner"],
    });
    await repo.addMembership(cohort.id, "student-1");
    // Re-adding the same (cohort,user) is idempotent, not a crash.
    await repo.addMembership(cohort.id, "student-1");

    const resolved = await repo.getCohortForUser("student-1");
    expect(resolved?.id).toBe(cohort.id);
    // A user with no membership has no cohort.
    expect(await repo.getCohortForUser("nobody")).toBeNull();
  });

  it("getAllowedToolSlugs returns the parsed set, or null with no cohort", async () => {
    const cohort = await repo.createCohort({
      createdByUserId: "teacher-4",
      name: "Allowed set",
      allowedToolSlugs: ["mentorai", "scaffolding-feedback"],
    });
    await repo.addMembership(cohort.id, "student-2");

    const allowed = await repo.getAllowedToolSlugs("student-2");
    expect(allowed).toBeInstanceOf(Set);
    expect(allowed?.has("mentorai")).toBe(true);
    expect(allowed?.has("scaffolding-feedback")).toBe(true);
    expect(allowed?.has("peer-tutoring")).toBe(false);

    // No cohort → null (falls back to "all student tools" at the call site).
    expect(await repo.getAllowedToolSlugs("student-without-cohort")).toBeNull();
  });

  it("assigns and removes co-teachers; canManageCohort honours creator, assignee, admin", async () => {
    const cohort = await repo.createCohort({
      createdByUserId: "owner-teacher",
      name: "Team-taught",
      allowedToolSlugs: ["mentorai"],
    });

    // Creator manages; an unrelated teacher does not; an admin always does.
    let teacherIds = await repo.getCohortTeacherIds(cohort.id);
    expect(repo.canManageCohort({ id: "owner-teacher", role: "teacher" }, cohort, teacherIds)).toBe(
      true,
    );
    expect(repo.canManageCohort({ id: "other", role: "teacher" }, cohort, teacherIds)).toBe(false);
    expect(repo.canManageCohort({ id: "any-admin", role: "admin" }, cohort, teacherIds)).toBe(true);

    // Assign a co-teacher → they can now manage. Idempotent re-assign is a no-op.
    await repo.addCohortTeacher(cohort.id, "co-teacher");
    await repo.addCohortTeacher(cohort.id, "co-teacher");
    teacherIds = await repo.getCohortTeacherIds(cohort.id);
    expect(teacherIds.has("co-teacher")).toBe(true);
    expect(repo.canManageCohort({ id: "co-teacher", role: "teacher" }, cohort, teacherIds)).toBe(
      true,
    );

    // Remove them → management revoked.
    await repo.removeCohortTeacher(cohort.id, "co-teacher");
    teacherIds = await repo.getCohortTeacherIds(cohort.id);
    expect(teacherIds.has("co-teacher")).toBe(false);
    expect(repo.canManageCohort({ id: "co-teacher", role: "teacher" }, cohort, teacherIds)).toBe(
      false,
    );
  });

  it("listCohortsForManager returns owned AND assigned cohorts", async () => {
    const owned = await repo.createCohort({
      createdByUserId: "mgr-1",
      name: "Owned by mgr-1",
      allowedToolSlugs: ["mentorai"],
    });
    const assigned = await repo.createCohort({
      createdByUserId: "someone-else",
      name: "Assigned to mgr-1",
      allowedToolSlugs: ["mentorai"],
    });
    await repo.addCohortTeacher(assigned.id, "mgr-1");

    const names = (await repo.listCohortsForManager("mgr-1")).map((c) => c.name);
    expect(names).toContain("Owned by mgr-1");
    expect(names).toContain("Assigned to mgr-1");
    // No duplicate when a manager both owns and is assigned to the same cohort.
    await repo.addCohortTeacher(owned.id, "mgr-1");
    const namesAfter = (await repo.listCohortsForManager("mgr-1")).map((c) => c.name);
    expect(namesAfter.filter((n) => n === "Owned by mgr-1")).toHaveLength(1);
  });

  it("listAllCohorts spans every owner (admin oversight); deleteCohort removes it + its edges", async () => {
    const c1 = await repo.createCohort({
      createdByUserId: "owner-x",
      name: "X-instance cohort",
      allowedToolSlugs: ["mentorai"],
    });
    await repo.addMembership(c1.id, "member-1");
    await repo.addCohortTeacher(c1.id, "assistant-1");

    const all = await repo.listAllCohorts();
    expect(all.some((c) => c.name === "X-instance cohort")).toBe(true);

    // Admin deletes another owner's cohort → gone, along with memberships + teacher edges.
    await repo.deleteCohort(c1.id);
    expect(await repo.getCohort(c1.id)).toBeNull();
    expect(await repo.getCohortForUser("member-1")).toBeNull();
    expect((await repo.getCohortTeacherIds(c1.id)).size).toBe(0);
  });

  it("isCohortActive honours activeUntil (null = open-ended)", async () => {
    const open = await repo.createCohort({
      createdByUserId: "t",
      name: "Open",
      allowedToolSlugs: ["mentorai"],
      activeUntil: null,
    });
    const future = await repo.createCohort({
      createdByUserId: "t",
      name: "Future",
      allowedToolSlugs: ["mentorai"],
      activeUntil: new Date(Date.now() + 86_400_000),
    });
    const past = await repo.createCohort({
      createdByUserId: "t",
      name: "Past",
      allowedToolSlugs: ["mentorai"],
      activeUntil: new Date(Date.now() - 86_400_000),
    });
    expect(repo.isCohortActive(open)).toBe(true);
    expect(repo.isCohortActive(future)).toBe(true);
    expect(repo.isCohortActive(past)).toBe(false);
  });
});
