// @vitest-environment node
// P21.3: storage for role-agent reviews and the teacher's decisions. Owner-scoped like
// every repository: another teacher's course, review or decision is invisible.
import { beforeAll, describe, expect, it } from "vitest";
import type { AgentFinding } from "~/lib/agents/types";
import { alignedCourse, LO1, TEST1 } from "../courses/fixtures";

process.env.DATABASE_URL = "file::memory:";

type Repo = typeof import("~/server/repositories/agentReviews.server");
let repo: Repo;
let courses: typeof import("~/server/repositories/courses.server");
let users: typeof import("~/server/repositories/users.server");

const A = "reviews-user-a";
const B = "reviews-user-b";

beforeAll(async () => {
  repo = await import("~/server/repositories/agentReviews.server");
  courses = await import("~/server/repositories/courses.server");
  users = await import("~/server/repositories/users.server");
});

const FINDINGS: AgentFinding[] = [
  {
    severity: "warning",
    targetId: LO1,
    message: "De leeruitkomst is vaag.",
    suggestion: "Maak hem toetsbaar.",
  },
  { severity: "info", message: "Weinig formatieve toetsing.", suggestion: "Voeg een quiz toe." },
];

const course = (userId: string, name = "Datamodellering") =>
  courses.createCourse(userId, { name, data: alignedCourse() });

const review = (userId: string, courseId: string, findings = FINDINGS) =>
  repo.saveReview(userId, {
    courseId,
    agentId: "assessment",
    model: "claude-test",
    findings,
  });

describe("agent reviews repository", () => {
  it("round-trips a review with stable finding ids and the course's updatedAt", async () => {
    const c = await course(A);
    const saved = await review(A, c.id);
    expect(saved).not.toBeNull();
    expect(saved?.findings.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(saved?.findings[0]).toMatchObject(FINDINGS[0]!);
    expect(saved?.courseUpdatedAt.getTime()).toBe(c.updatedAt.getTime());

    const fetched = await repo.getReview(A, saved!.id);
    expect(fetched).toEqual(saved);
    expect((await repo.listReviewsForCourse(A, c.id)).map((r) => r.id)).toEqual([saved!.id]);
  });

  it("refuses a review for someone else's course and hides another teacher's reviews", async () => {
    const theirs = await course(B);
    expect(await review(A, theirs.id)).toBeNull();
    const mine = await review(B, theirs.id);
    expect(await repo.getReview(A, mine!.id)).toBeNull();
    expect(await repo.listReviewsForCourse(A, theirs.id)).toEqual([]);
  });

  it("refuses more findings than a hat may return", async () => {
    const c = await course(A);
    const many = Array.from({ length: 16 }, () => FINDINGS[1]!);
    await expect(review(A, c.id, many)).rejects.toThrow();
  });

  it("records a decision once per finding; deciding again replaces it", async () => {
    const c = await course(A);
    const r = await review(A, c.id);
    const first = await repo.decideFinding(A, {
      reviewId: r!.id,
      findingId: "f1",
      decision: "accepted",
    });
    expect(first).toMatchObject({ findingId: "f1", decision: "accepted", reason: null });
    const second = await repo.decideFinding(A, {
      reviewId: r!.id,
      findingId: "f1",
      decision: "rejected",
      reason: "  Bewuste keuze.  ",
    });
    expect(second).toMatchObject({ decision: "rejected", reason: "Bewuste keuze." });
    const decisions = await repo.listDecisions(A, r!.id);
    expect(decisions).toHaveLength(1);
    expect(decisions[0]!.decision).toBe("rejected");
  });

  it("refuses a decision on someone else's review or an unknown finding", async () => {
    const theirs = await course(B);
    const r = await review(B, theirs.id);
    expect(
      await repo.decideFinding(A, { reviewId: r!.id, findingId: "f1", decision: "rejected" }),
    ).toBeNull();
    expect(await repo.listDecisions(B, r!.id)).toEqual([]);
    expect(
      await repo.decideFinding(B, { reviewId: r!.id, findingId: "f9", decision: "accepted" }),
    ).toBeNull();
  });

  it("refuses a reason longer than 500 characters", async () => {
    const c = await course(A);
    const r = await review(A, c.id);
    await expect(
      repo.decideFinding(A, {
        reviewId: r!.id,
        findingId: "f1",
        decision: "rejected",
        reason: "x".repeat(501),
      }),
    ).rejects.toThrow();
  });

  it("lists the rejected findings of a course, for the next review", async () => {
    const c = await course(A);
    const r1 = await review(A, c.id);
    const r2 = await review(A, c.id, [
      { severity: "warning", targetId: TEST1, message: "Weging klopt niet.", suggestion: "" },
    ]);
    await repo.decideFinding(A, { reviewId: r1!.id, findingId: "f1", decision: "rejected" });
    await repo.decideFinding(A, { reviewId: r1!.id, findingId: "f2", decision: "accepted" });
    await repo.decideFinding(A, { reviewId: r2!.id, findingId: "f1", decision: "rejected" });
    const rejected = await repo.listRejectedFindings(A, c.id);
    expect(rejected).toHaveLength(2);
    expect(rejected).toContainEqual({ targetId: LO1, message: "De leeruitkomst is vaag." });
    expect(rejected).toContainEqual({ targetId: TEST1, message: "Weging klopt niet." });
    expect(await repo.listRejectedFindings(B, c.id)).toEqual([]);
  });

  it("caps the list and orders newest first", async () => {
    const c = await course(A);
    for (let i = 0; i < 4; i++) await review(A, c.id);
    const two = await repo.listReviewsForCourse(A, c.id, 2);
    expect(two).toHaveLength(2);
    const all = await repo.listReviewsForCourse(A, c.id);
    expect(all).toHaveLength(4);
    expect(all[0]!.createdAt.getTime()).toBeGreaterThanOrEqual(all[3]!.createdAt.getTime());
  });

  it("deleteCourse removes its reviews and decisions", async () => {
    const c = await course(A);
    const r = await review(A, c.id);
    await repo.decideFinding(A, { reviewId: r!.id, findingId: "f1", decision: "rejected" });
    await courses.deleteCourse(A, c.id);
    expect(await repo.getReview(A, r!.id)).toBeNull();
    expect(await repo.listDecisions(A, r!.id)).toEqual([]);
  });

  it("deleteUserCascade removes reviews and decisions", async () => {
    const C = "reviews-user-c";
    await users.createUser({ id: C, name: "C", passwordHash: "x", role: "teacher" });
    const c = await course(C);
    const r = await review(C, c.id);
    await repo.decideFinding(C, { reviewId: r!.id, findingId: "f2", decision: "accepted" });
    await users.deleteUserCascade(C);
    expect(await repo.getReview(C, r!.id)).toBeNull();
    expect(await repo.listDecisions(C, r!.id)).toEqual([]);
  });
});
