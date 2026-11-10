import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let members: typeof import("~/server/repositories/courseMembers.server");
let courses: typeof import("~/server/repositories/courses.server");
let shares: typeof import("~/server/repositories/shares.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let generations: typeof import("~/server/repositories/generations.server");
let reviews: typeof import("~/server/repositories/agentReviews.server");

let n = 0;
/** A fresh owner A, team-mate B, outsider C and a team with A and B in it. */
async function world() {
  n += 1;
  const mk = (who: string) =>
    users.createUser({
      id: `${who}-${n}`,
      name: `${who} ${n}`,
      passwordHash: "x",
      role: "teacher",
    });
  const [a, b, c] = await Promise.all([mk("A"), mk("B"), mk("C")]);
  const team = await teams.createTeam(`Team ${n}`);
  await teams.addMember(team.id, a.id);
  await teams.addMember(team.id, b.id);
  return { a: a.id, b: b.id, c: c.id, team: team.id };
}

beforeAll(async () => {
  members = await import("~/server/repositories/courseMembers.server");
  courses = await import("~/server/repositories/courses.server");
  shares = await import("~/server/repositories/shares.server");
  profiles = await import("~/server/repositories/profiles.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  generations = await import("~/server/repositories/generations.server");
  reviews = await import("~/server/repositories/agentReviews.server");
});

let w: Awaited<ReturnType<typeof world>>;
beforeEach(async () => {
  w = await world();
});

const newCourse = (owner: string, name = "Statistiek") =>
  courses.createCourse(owner, { name, data: alignedCourse() });

const work = (userId: string) =>
  generations.saveGeneration({
    userId,
    toolSlug: "lesson-plan",
    model: "m",
    input: {},
    outputLanguage: "nl",
    outputMarkdown: "x",
  });

describe("course editors (BESLUIT-2026-11-10-4)", () => {
  it("lets the owner add a team-mate as editor, never an outsider or themselves", async () => {
    const course = await newCourse(w.a);
    expect(await members.setCourseMember(w.a, course.id, w.c, "editor")).toBe(false);
    expect(await members.setCourseMember(w.a, course.id, w.a, "editor")).toBe(false);
    expect(await members.setCourseMember(w.a, course.id, w.b, "editor")).toBe(true);
    expect(await members.listCourseMembers(w.a, course.id)).toEqual([
      { userId: w.b, name: `B ${n}`, role: "editor" },
    ]);
  });

  it("lets an editor choose no one", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    await teams.addMember(w.team, w.c);
    expect(await members.setCourseMember(w.b, course.id, w.c, "editor")).toBe(false);
    expect(await members.removeCourseMember(w.b, course.id, w.b)).toBe(false);
    expect(await members.listCourseMembers(w.c, course.id)).toEqual([]);
  });

  it("offers the owner's team-mates who are not yet editor", async () => {
    const course = await newCourse(w.a);
    expect(await members.listMemberCandidates(w.a, course.id)).toEqual([
      { userId: w.b, name: `B ${n}` },
    ]);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await members.listMemberCandidates(w.a, course.id)).toEqual([]);
    expect(await members.listMemberCandidates(w.b, course.id)).toEqual([]);
  });

  it("gives an editor the course in their list, with the owner's name, and lets them edit it", async () => {
    const course = await newCourse(w.a);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    await members.setCourseMember(w.a, course.id, w.b, "editor");

    const listed = await courses.listCourses(w.b);
    expect(listed).toEqual([
      expect.objectContaining({ id: course.id, ownerId: w.a, ownerName: `A ${n}` }),
    ]);
    const updated = await courses.updateCourse(w.b, course.id, { name: "Statistiek 2" });
    expect(updated?.name).toBe("Statistiek 2");
    expect((await courses.getCourse(w.a, course.id))?.name).toBe("Statistiek 2");
    // The owner's own list says it is theirs.
    expect((await courses.listCourses(w.a))[0]).toMatchObject({ ownerId: w.a });
  });

  it("does not let an editor delete the course or change its context profile", async () => {
    const profile = await profiles.createProfile(w.a, { name: "Profiel A" });
    const course = await courses.createCourse(w.a, {
      name: "Statistiek",
      contextProfileId: profile.id,
      data: alignedCourse(),
    });
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await courses.deleteCourse(w.b, course.id)).toBe(false);
    await expect(
      courses.updateCourse(w.b, course.id, { contextProfileId: null }),
    ).rejects.toThrow();
    // Saving without touching the profile keeps the owner's profile.
    await courses.updateCourse(w.b, course.id, { contextProfileId: profile.id, name: "Nieuw" });
    expect((await courses.getCourse(w.a, course.id))?.contextProfileId).toBe(profile.id);
  });

  it("does not let an editor share the course with a team", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await shares.shareItem(w.b, "course", course.id, w.team)).toBe(false);
  });

  it("lets an editor link their own work, and keeps it theirs", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    const g = await work(w.b);
    expect(await courses.linkGeneration(w.b, course.id, g.id)).not.toBeNull();
    expect((await courses.listLinkedWork(w.b, course.id)).map((l) => l.generationId)).toEqual([
      g.id,
    ]);
    expect(await courses.listLinkedWork(w.a, course.id)).toEqual([]);
  });

  it("ends access when the owner removes an editor or the editor leaves", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await members.removeCourseMember(w.a, course.id, w.b)).toBe(true);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();

    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await members.leaveCourse(w.b, course.id)).toBe(true);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    expect(await courses.updateCourse(w.b, course.id, { name: "Te laat" })).toBeNull();
  });

  it("deletes the course with everyone's links, reviews and editors", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    const g = await work(w.b);
    await courses.linkGeneration(w.b, course.id, g.id);
    await reviews.saveReview(w.b, {
      courseId: course.id,
      agentId: "designer",
      model: "m",
      findings: [],
    });
    expect(await courses.deleteCourse(w.a, course.id)).toBe(true);
    expect(await courses.listCourseLinksForUser(w.b)).toEqual([]);
    expect(await reviews.listReviewsForCourse(w.b, course.id)).toEqual([]);
    expect(await courses.listCourses(w.b)).toEqual([]);
  });

  it("drops a deleted account's editorships and the editors of its courses", async () => {
    const course = await newCourse(w.a);
    const theirs = await newCourse(w.b, "Van B");
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    await members.setCourseMember(w.b, theirs.id, w.a, "editor");
    await users.deleteUserCascade(w.b);
    expect(await members.listCourseMembers(w.a, course.id)).toEqual([]);
    expect((await courses.listCourses(w.a)).map((c) => c.id)).toEqual([course.id]);
  });

  it("keeps an editor's stale links consistent when an item leaves the course", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    const g = await work(w.b);
    const item = course.data.activities[0]!.id;
    await courses.linkGeneration(w.b, course.id, g.id, item);
    await courses.updateCourse(w.a, course.id, {
      data: { ...course.data, activities: course.data.activities.slice(1) },
    });
    expect((await courses.listLinkedWork(w.b, course.id))[0]?.itemId).toBeNull();
  });
});

describe("course co-owners (BESLUIT-2026-11-10-4)", () => {
  /** A co-owner D who is in team 2 with outsider E; the course owner A is not. */
  async function coOwnerWorld() {
    const mk = (who: string) =>
      users.createUser({
        id: `${who}-${n}`,
        name: `${who} ${n}`,
        passwordHash: "x",
        role: "teacher",
      });
    const [d, e] = await Promise.all([mk("D"), mk("E")]);
    await teams.addMember(w.team, d.id);
    const module = await teams.createTeam(`Module ${n}`);
    await teams.addMember(module.id, d.id);
    await teams.addMember(module.id, e.id);
    const course = await newCourse(w.a);
    expect(await members.setCourseMember(w.a, course.id, d.id, "co-owner")).toBe(true);
    return { d: d.id, e: e.id, module: module.id, course };
  }

  it("lets a co-owner choose members among their own team-mates", async () => {
    const { d, e, course } = await coOwnerWorld();
    expect(await members.canManageCourse(d, course.id)).toBe(true);
    expect((await members.listMemberCandidates(d, course.id)).map((p) => p.userId)).toEqual(
      expect.arrayContaining([w.b, e]),
    );
    expect(await members.setCourseMember(d, course.id, e, "editor")).toBe(true);
    expect(await members.setCourseMember(d, course.id, w.a, "editor")).toBe(false);
    expect(
      (await members.listCourseMembers(w.a, course.id)).map((m) => [m.userId, m.role]),
    ).toEqual([
      [d, "co-owner"],
      [e, "editor"],
    ]);
    expect(await members.removeCourseMember(d, course.id, e)).toBe(true);
  });

  it("lets a co-owner share the course with their own team, and stop it", async () => {
    const { d, e, module, course } = await coOwnerWorld();
    expect(await shares.shareItem(d, "course", course.id, module)).toBe(true);
    expect((await shares.listSharedWithMe(e, "course")).map((c) => c.id)).toEqual([course.id]);
    expect(await shares.listItemShares(w.a, "course", course.id)).toEqual([module]);
    // The owner stops a share the co-owner made.
    expect(await shares.stopSharing(w.a, "course", course.id, module)).toBe(true);
    expect(await shares.listSharedWithMe(e, "course")).toEqual([]);
  });

  it("ends a co-owner's shares when they become editor or leave", async () => {
    const { d, e, module, course } = await coOwnerWorld();
    await shares.shareItem(d, "course", course.id, module);
    await members.setCourseMember(w.a, course.id, d, "editor");
    expect(await shares.listSharedWithMe(e, "course")).toEqual([]);
    expect(await shares.shareItem(d, "course", course.id, module)).toBe(false);
  });

  it("does not let a co-owner delete the course or change its context profile", async () => {
    const { d, course } = await coOwnerWorld();
    const profile = await profiles.createProfile(d, { name: "Van D" });
    expect(await courses.deleteCourse(d, course.id)).toBe(false);
    await expect(
      courses.updateCourse(d, course.id, { contextProfileId: profile.id }),
    ).rejects.toThrow();
    expect((await courses.updateCourse(d, course.id, { name: "Samen" }))?.name).toBe("Samen");
  });

  it("does not let an editor manage the course", async () => {
    const course = await newCourse(w.a);
    await members.setCourseMember(w.a, course.id, w.b, "editor");
    expect(await members.canManageCourse(w.b, course.id)).toBe(false);
    expect(await members.listMemberCandidates(w.b, course.id)).toEqual([]);
    expect(await members.removeCourseMember(w.b, course.id, w.b)).toBe(false);
  });
});
