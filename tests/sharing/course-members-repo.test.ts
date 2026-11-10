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

describe("course editors (BESLUIT-2026-11-10-3)", () => {
  it("lets the owner add a team-mate as editor, never an outsider or themselves", async () => {
    const course = await newCourse(w.a);
    expect(await members.addCourseEditor(w.a, course.id, w.c)).toBe(false);
    expect(await members.addCourseEditor(w.a, course.id, w.a)).toBe(false);
    expect(await members.addCourseEditor(w.a, course.id, w.b)).toBe(true);
    expect(await members.listCourseEditors(w.a, course.id)).toEqual([
      { userId: w.b, name: `B ${n}` },
    ]);
  });

  it("lets only the owner choose editors", async () => {
    const course = await newCourse(w.a);
    await members.addCourseEditor(w.a, course.id, w.b);
    await teams.addMember(w.team, w.c);
    expect(await members.addCourseEditor(w.b, course.id, w.c)).toBe(false);
    expect(await members.removeCourseEditor(w.b, course.id, w.b)).toBe(false);
    expect(await members.listCourseEditors(w.c, course.id)).toEqual([]);
  });

  it("offers the owner's team-mates who are not yet editor", async () => {
    const course = await newCourse(w.a);
    expect(await members.listEditorCandidates(w.a, course.id)).toEqual([
      { userId: w.b, name: `B ${n}` },
    ]);
    await members.addCourseEditor(w.a, course.id, w.b);
    expect(await members.listEditorCandidates(w.a, course.id)).toEqual([]);
    expect(await members.listEditorCandidates(w.b, course.id)).toEqual([]);
  });

  it("gives an editor the course in their list, with the owner's name, and lets them edit it", async () => {
    const course = await newCourse(w.a);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    await members.addCourseEditor(w.a, course.id, w.b);

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
    await members.addCourseEditor(w.a, course.id, w.b);
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
    await members.addCourseEditor(w.a, course.id, w.b);
    expect(await shares.shareItem(w.b, "course", course.id, w.team)).toBe(false);
  });

  it("lets an editor link their own work, and keeps it theirs", async () => {
    const course = await newCourse(w.a);
    await members.addCourseEditor(w.a, course.id, w.b);
    const g = await work(w.b);
    expect(await courses.linkGeneration(w.b, course.id, g.id)).not.toBeNull();
    expect((await courses.listLinkedWork(w.b, course.id)).map((l) => l.generationId)).toEqual([
      g.id,
    ]);
    expect(await courses.listLinkedWork(w.a, course.id)).toEqual([]);
  });

  it("ends access when the owner removes an editor or the editor leaves", async () => {
    const course = await newCourse(w.a);
    await members.addCourseEditor(w.a, course.id, w.b);
    expect(await members.removeCourseEditor(w.a, course.id, w.b)).toBe(true);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();

    await members.addCourseEditor(w.a, course.id, w.b);
    expect(await members.leaveCourse(w.b, course.id)).toBe(true);
    expect(await courses.getCourse(w.b, course.id)).toBeNull();
    expect(await courses.updateCourse(w.b, course.id, { name: "Te laat" })).toBeNull();
  });

  it("deletes the course with everyone's links, reviews and editors", async () => {
    const course = await newCourse(w.a);
    await members.addCourseEditor(w.a, course.id, w.b);
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
    await members.addCourseEditor(w.a, course.id, w.b);
    await members.addCourseEditor(w.b, theirs.id, w.a);
    await users.deleteUserCascade(w.b);
    expect(await members.listCourseEditors(w.a, course.id)).toEqual([]);
    expect((await courses.listCourses(w.a)).map((c) => c.id)).toEqual([course.id]);
  });

  it("keeps an editor's stale links consistent when an item leaves the course", async () => {
    const course = await newCourse(w.a);
    await members.addCourseEditor(w.a, course.id, w.b);
    const g = await work(w.b);
    const item = course.data.activities[0]!.id;
    await courses.linkGeneration(w.b, course.id, g.id, item);
    await courses.updateCourse(w.a, course.id, {
      data: { ...course.data, activities: course.data.activities.slice(1) },
    });
    expect((await courses.listLinkedWork(w.b, course.id))[0]?.itemId).toBeNull();
  });
});
