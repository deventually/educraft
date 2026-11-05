import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sampleRubric } from "../utilities/fixtures";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let shares: typeof import("~/server/repositories/shares.server");
let courses: typeof import("~/server/repositories/courses.server");
let rubrics: typeof import("~/server/repositories/rubrics.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let teams: typeof import("~/server/repositories/teams.server");
let users: typeof import("~/server/repositories/users.server");
let generations: typeof import("~/server/repositories/generations.server");

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
  shares = await import("~/server/repositories/shares.server");
  courses = await import("~/server/repositories/courses.server");
  rubrics = await import("~/server/repositories/rubrics.server");
  profiles = await import("~/server/repositories/profiles.server");
  teams = await import("~/server/repositories/teams.server");
  users = await import("~/server/repositories/users.server");
  generations = await import("~/server/repositories/generations.server");
});

let w: Awaited<ReturnType<typeof world>>;
beforeEach(async () => {
  w = await world();
});

describe("shares repository (P28.4)", () => {
  it("keeps everything private until the owner shares it", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    expect(await shares.listSharedWithMe(w.b, "course")).toEqual([]);
    expect(await shares.getSharedCourse(w.b, course.id)).toBeNull();
  });

  it("lets a team-mate read a shared course, with the owner's name, and an outsider nothing", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    expect(await shares.shareItem(w.a, "course", course.id, w.team)).toBe(true);

    const seen = await shares.listSharedWithMe(w.b, "course");
    expect(seen).toEqual([
      expect.objectContaining({ id: course.id, name: "Statistiek", ownerName: `A ${n}` }),
    ]);
    expect((await shares.getSharedCourse(w.b, course.id))?.data).toEqual(course.data);

    expect(await shares.listSharedWithMe(w.c, "course")).toEqual([]);
    expect(await shares.getSharedCourse(w.c, course.id)).toBeNull();
    // The owner sees it in their own list, not under "from my team".
    expect(await shares.listSharedWithMe(w.a, "course")).toEqual([]);
  });

  it("lets only the owner share, and only with a team they are in", async () => {
    const course = await courses.createCourse(w.a, { name: "Eigen", data: alignedCourse() });
    expect(await shares.shareItem(w.b, "course", course.id, w.team)).toBe(false);
    const other = await teams.createTeam(`Ander ${n}`);
    expect(await shares.shareItem(w.a, "course", course.id, other.id)).toBe(false);
    expect(await shares.listItemShares(w.a, "course", course.id)).toEqual([]);
  });

  it("does not let a team-mate write: their update and delete find nothing", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    await shares.shareItem(w.a, "course", course.id, w.team);
    expect(await courses.updateCourse(w.b, course.id, { name: "Gekaapt" })).toBeNull();
    expect(await courses.deleteCourse(w.b, course.id)).toBe(false);
    expect((await courses.getCourse(w.a, course.id))?.name).toBe("Statistiek");
  });

  it("refuses to link a team-mate's generation to a shared course", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    await shares.shareItem(w.a, "course", course.id, w.team);
    const g = await generations.saveGeneration({
      userId: w.b,
      toolSlug: "lesson-plan",
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "x",
    });
    expect(await courses.linkGeneration(w.b, course.id, g.id)).toBeNull();
  });

  it("makes a copy that belongs to the copier, without links or shares", async () => {
    const profile = await profiles.createProfile(w.a, { name: "Profiel A" });
    const course = await courses.createCourse(w.a, {
      name: "Statistiek",
      contextProfileId: profile.id,
      data: alignedCourse(),
    });
    await shares.shareItem(w.a, "course", course.id, w.team);
    const copyId = await shares.copySharedItem(w.b, "course", course.id);
    expect(copyId).toBeTruthy();
    const copy = await courses.getCourse(w.b, copyId!);
    expect(copy).toMatchObject({ name: "Statistiek", contextProfileId: null, data: course.data });
    expect(await courses.listLinksForCourse(w.b, copyId!)).toEqual([]);
    expect(await shares.listItemShares(w.b, "course", copyId!)).toEqual([]);
    // An outsider cannot copy.
    expect(await shares.copySharedItem(w.c, "course", course.id)).toBeNull();
  });

  it("shares and copies a rubric and a context profile the same way", async () => {
    const rubric = await rubrics.createRubric(w.a, "Verslag", sampleRubric());
    const profile = await profiles.createProfile(w.a, { name: "HBO-ICT jaar 2" });
    await shares.shareItem(w.a, "rubric", rubric.id, w.team);
    await shares.shareItem(w.a, "contextProfile", profile.id, w.team);

    expect((await shares.getSharedRubric(w.b, rubric.id))?.data).toEqual(rubric.data);
    expect(await shares.getSharedRubric(w.c, rubric.id)).toBeNull();
    expect((await shares.listSharedWithMe(w.b, "contextProfile")).map((p) => p.name)).toEqual([
      "HBO-ICT jaar 2",
    ]);
    expect((await shares.getSharedProfile(w.b, profile.id))?.name).toBe("HBO-ICT jaar 2");

    const rubricCopy = await shares.copySharedItem(w.b, "rubric", rubric.id);
    expect((await rubrics.getRubric(w.b, rubricCopy!))?.data).toEqual(rubric.data);
    const profileCopy = await shares.copySharedItem(w.b, "contextProfile", profile.id);
    expect((await profiles.getProfile(w.b, profileCopy!))?.name).toBe("HBO-ICT jaar 2");
  });

  it("stops sharing: the team-mate no longer sees it, but their copy stays", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    await shares.shareItem(w.a, "course", course.id, w.team);
    const copyId = await shares.copySharedItem(w.b, "course", course.id);
    expect(await shares.stopSharing(w.a, "course", course.id, w.team)).toBe(true);
    expect(await shares.getSharedCourse(w.b, course.id)).toBeNull();
    expect(await courses.getCourse(w.b, copyId!)).not.toBeNull();
  });

  it("drops what a member shared with a team when they leave it, and they no longer see the team's items", async () => {
    const mine = await courses.createCourse(w.a, { name: "Van A", data: alignedCourse() });
    const theirs = await courses.createCourse(w.b, { name: "Van B", data: alignedCourse() });
    await shares.shareItem(w.a, "course", mine.id, w.team);
    await shares.shareItem(w.b, "course", theirs.id, w.team);

    await teams.removeMember(w.team, w.b);
    expect(await shares.getSharedCourse(w.b, mine.id)).toBeNull();
    expect(await shares.listItemShares(w.b, "course", theirs.id)).toEqual([]);
    // Joining again does not bring the old share back.
    await teams.addMember(w.team, w.b);
    expect(await shares.getSharedCourse(w.a, theirs.id)).toBeNull();
  });

  it("makes shared items private again when the team is removed", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    await shares.shareItem(w.a, "course", course.id, w.team);
    await teams.deleteTeam(w.team);
    expect(await shares.getSharedCourse(w.b, course.id)).toBeNull();
    expect(await shares.listItemShares(w.a, "course", course.id)).toEqual([]);
  });

  it("drops the shares of an item when its owner deletes it", async () => {
    const rubric = await rubrics.createRubric(w.a, "Weg", sampleRubric());
    await shares.shareItem(w.a, "rubric", rubric.id, w.team);
    await rubrics.deleteRubric(w.a, rubric.id);
    expect(await shares.listSharedWithMe(w.b, "rubric")).toEqual([]);
    expect(await shares.listItemShares(w.a, "rubric", rubric.id)).toEqual([]);
  });

  it("shows linked work of a shared course, but never from a tool that handles student work", async () => {
    const course = await courses.createCourse(w.a, { name: "Statistiek", data: alignedCourse() });
    const save = (toolSlug: string, out: string) =>
      generations.saveGeneration({
        userId: w.a,
        toolSlug,
        model: "m",
        input: {},
        outputLanguage: "nl",
        outputMarkdown: out,
      });
    const plan = await save("lesson-plan", "# Lesopzet");
    const graded = await save("stage-assessment", "Feedback op het werk van een student");
    await courses.linkGeneration(w.a, course.id, plan.id);
    await courses.linkGeneration(w.a, course.id, graded.id);
    await shares.shareItem(w.a, "course", course.id, w.team);

    const work = await shares.listSharedCourseWork(w.b, course.id);
    expect(work.map((x) => x.toolSlug)).toEqual(["lesson-plan"]);
    expect(work[0].outputMarkdown).toBe("# Lesopzet");
    expect(await shares.listSharedCourseWork(w.c, course.id)).toEqual([]);
  });
});
