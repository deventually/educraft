import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse } from "./fixtures";
import { forNewRun } from "~/lib/courses/newRun";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let members: typeof import("~/server/repositories/courseMembers.server");
let shares: typeof import("~/server/repositories/shares.server");
let profiles: typeof import("~/server/repositories/profiles.server");
let generations: typeof import("~/server/repositories/generations.server");
let courseDetail: typeof import("~/routes/courses.$id");
let team = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  members = await import("~/server/repositories/courseMembers.server");
  shares = await import("~/server/repositories/shares.server");
  profiles = await import("~/server/repositories/profiles.server");
  generations = await import("~/server/repositories/generations.server");
  courseDetail = await import("~/routes/courses.$id");
  const users = await import("~/server/repositories/users.server");
  const teams = await import("~/server/repositories/teams.server");
  for (const [id, name] of [
    ["run-a", "Anna"],
    ["run-b", "Bram"],
  ] as const)
    await users.createUser({ id, name, passwordHash: "x", role: "teacher" });
  team = (await teams.createTeam("Wiskunde")).id;
  await teams.addMember(team, "run-a");
  await teams.addMember(team, "run-b");
});

beforeEach(() => signInAs({ id: "run-a" }));

const lastYear = () => ({
  ...alignedCourse(),
  code: "WIS1",
  studyYear: "2025-2026",
  phase: "Periode 2",
  startDate: "2025-11-10",
  schedule: { weeks: 8, sessionsPerWeek: 2 },
});

describe("forNewRun (a course for its next run)", () => {
  it("sets the study year, the semester or period and the start date, and keeps the rest", () => {
    const data = forNewRun(lastYear(), {
      studyYear: "2026-2027",
      phase: "Semester 1",
      startDate: "2026-09-07",
    });
    expect(data).toEqual({
      ...lastYear(),
      studyYear: "2026-2027",
      phase: "Semester 1",
      startDate: "2026-09-07",
    });
  });

  it("leaves out what the teacher leaves empty", () => {
    const data = forNewRun(lastYear(), { studyYear: "2026-2027" });
    expect(data.studyYear).toBe("2026-2027");
    expect(data).not.toHaveProperty("phase");
    expect(data).not.toHaveProperty("startDate");
    expect(data.outcomes).toEqual(lastYear().outcomes);
  });
});

describe("copyCourse (a new run of an own course)", () => {
  it("copies outcomes, tests, lessons and schedule, and none of the sharing, members or work", async () => {
    const profile = await profiles.createProfile("run-a", { name: "Havo 4" });
    const course = await courses.createCourse("run-a", {
      name: "Statistiek",
      contextProfileId: profile.id,
      data: lastYear(),
    });
    await members.setCourseMember("run-a", course.id, "run-b", "editor");
    await shares.shareItem("run-a", "course", course.id, team);
    const g = await generations.saveGeneration({
      userId: "run-a",
      toolSlug: "lesson-plan",
      model: "m",
      input: {},
      outputLanguage: "nl",
      outputMarkdown: "x",
    });
    await courses.linkGeneration("run-a", course.id, g.id, "act-1");

    const copy = await courses.copyCourse("run-a", course.id, {
      name: "Statistiek 2026-2027",
      studyYear: "2026-2027",
      phase: "Semester 1",
      startDate: "2026-09-07",
    });

    expect(copy).toMatchObject({
      ownerId: "run-a",
      role: "owner",
      name: "Statistiek 2026-2027",
      contextProfileId: profile.id,
      data: { ...lastYear(), studyYear: "2026-2027", phase: "Semester 1", startDate: "2026-09-07" },
    });
    expect(copy?.id).not.toBe(course.id);
    expect(await courses.listLinksForCourse("run-a", copy!.id)).toEqual([]);
    expect(await members.listCourseMembers("run-a", copy!.id)).toEqual([]);
    expect(await shares.listItemShares("run-a", "course", copy!.id)).toEqual([]);
    // The original stays as it was.
    expect((await courses.getCourse("run-a", course.id))?.data).toEqual(lastYear());
    expect(await courses.listLinksForCourse("run-a", course.id)).toHaveLength(1);
  });

  it("is for the owner and a co-owner; an editor or a stranger gets null", async () => {
    const profile = await profiles.createProfile("run-a", { name: "Vwo 5" });
    const course = await courses.createCourse("run-a", {
      name: "Kansen",
      contextProfileId: profile.id,
      data: lastYear(),
    });
    await members.setCourseMember("run-a", course.id, "run-b", "editor");
    expect(await courses.copyCourse("run-b", course.id, { name: "Kansen" })).toBeNull();
    expect(await courses.copyCourse("run-b", "nope", { name: "Kansen" })).toBeNull();
    // A co-owner's copy is theirs, without the owner's context profile.
    await members.setCourseMember("run-a", course.id, "run-b", "co-owner");
    expect(await courses.copyCourse("run-b", course.id, { name: "Kansen" })).toMatchObject({
      ownerId: "run-b",
      role: "owner",
      contextProfileId: null,
      data: { outcomes: lastYear().outcomes },
    });
  });

  it("refuses an invalid start date or name and writes nothing", async () => {
    const course = await courses.createCourse("run-a", { name: "Algebra", data: lastYear() });
    const before = (await courses.listCourses("run-a")).length;
    await expect(
      courses.copyCourse("run-a", course.id, { name: "Algebra", startDate: "7-9-2026" }),
    ).rejects.toThrow();
    await expect(courses.copyCourse("run-a", course.id, { name: " " })).rejects.toThrow();
    expect(await courses.listCourses("run-a")).toHaveLength(before);
  });
});

function post(id: string, fields: Record<string, string>) {
  return courseDetail.action({
    request: signedRequest(`http://localhost/courses/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never);
}

describe("the course page's copy-run intent", () => {
  it("makes the copy and opens its Controle tab", async () => {
    const course = await courses.createCourse("run-a", { name: "Meetkunde", data: lastYear() });
    const res = (await post(course.id, {
      intent: "copy-run",
      name: "Meetkunde 2026-2027",
      studyYear: "2026-2027",
      phase: "Semester 2",
      startDate: "2027-02-01",
    }).catch((thrown: unknown) => thrown)) as Response;
    expect(res.status).toBe(302);
    const location = res.headers.get("Location") ?? "";
    const match = location.match(/^\/courses\/([^?]+)\?tab=check&copied=1$/);
    expect(match).not.toBeNull();
    const copy = await courses.getCourse("run-a", match![1]!);
    expect(copy).toMatchObject({
      name: "Meetkunde 2026-2027",
      data: { studyYear: "2026-2027", phase: "Semester 2", startDate: "2027-02-01" },
    });
  });

  it("tells an editor that only the owner or a co-owner copies, and a bad date that it is wrong", async () => {
    const course = await courses.createCourse("run-a", { name: "Logica", data: lastYear() });
    expect(await post(course.id, { intent: "copy-run", name: "Logica", startDate: "x" })).toEqual({
      ok: false,
      intent: "copy-run",
      error: "Kopiëren lukt niet. Kijk de naam en de startdatum na.",
    });
    await members.setCourseMember("run-a", course.id, "run-b", "editor");
    await signInAs({ id: "run-b" });
    expect(await post(course.id, { intent: "copy-run", name: "Logica" })).toEqual({
      ok: false,
      intent: "copy-run",
      error: "Alleen de eigenaar of een mede-eigenaar kan deze cursus kopiëren.",
    });
  });
});

describe("the courses help topic", () => {
  it("explains giving a course again, in both languages", async () => {
    const { getTopic } = await import("~/lib/help/registry");
    expect(getTopic("courses", "nl")).toMatch(
      /## Een cursus opnieuw geven\n\n.*Kopiëren voor een nieuwe uitvoering/,
    );
    expect(getTopic("courses", "en")).toMatch(/## Teaching a course again\n\n.*Copy for a new run/);
  });
});
