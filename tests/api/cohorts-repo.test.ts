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
