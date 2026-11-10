import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let settings: typeof import("~/server/repositories/settings.server");
let start: typeof import("~/routes/start");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  settings = await import("~/server/repositories/settings.server");
  start = await import("~/routes/start");
});

beforeEach(async () => {
  await signInAs({ id: "teacher-a", name: "A" });
});

const load = (path = "/start", locale = "nl") =>
  start.loader({
    request: signedRequest(`http://localhost${path}`, { headers: { Cookie: `lang=${locale}` } }),
    params: {},
    context: {},
  } as never);

/** A course with one outcome and nothing else: "not taught" and "not assessed". */
const gappyCourse = () => ({
  outcomes: [{ id: "lo-x", text: "Je schrijft een plan.", bloom: "create" as const }],
  activities: [],
  assessments: [],
});

const save = (userId: string, toolSlug: string) =>
  generations.saveGeneration({
    userId,
    toolSlug,
    model: "m",
    input: {},
    outputLanguage: "nl",
    outputMarkdown: "x",
  });

describe("/start (P27.3)", () => {
  it("is empty for a new teacher: no courses, no week, no results", async () => {
    await signInAs({ id: "new", name: "N" });
    expect(await load()).toMatchObject({
      query: "",
      results: [],
      courses: [],
      week: { findings: [], recent: [] },
    });
  });

  it("lists own courses with their number of open findings, never someone else's", async () => {
    const mine = await courses.createCourse("teacher-a", { name: "Plan", data: gappyCourse() });
    await courses.createCourse("teacher-a", { name: "Netjes", data: alignedCourse() });
    await courses.createCourse("teacher-b", { name: "Van B", data: gappyCourse() });
    const data = await load();
    expect(data.courses).toEqual(
      expect.arrayContaining([
        { id: mine.id, name: "Plan", findings: 2 },
        expect.objectContaining({ name: "Netjes", findings: 0 }),
      ]),
    );
    expect(data.courses?.map((c) => c.name)).not.toContain("Van B");
    // This week: the open findings, in words, with their course.
    expect(data.week.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          courseId: mine.id,
          courseName: "Plan",
          text: expect.any(String),
        }),
      ]),
    );
    expect(data.week.findings.every((f) => f.courseName !== "Van B")).toBe(true);
  });

  it("shows at most five findings and the five newest own results", async () => {
    await signInAs({ id: "busy", name: "B" });
    for (const n of [1, 2, 3])
      await courses.createCourse("busy", { name: `C${n}`, data: gappyCourse() });
    for (let i = 0; i < 7; i++) await save("busy", "rubric-builder");
    await save("someone-else", "test-items");
    const data = await load();
    expect(data.week.findings).toHaveLength(5);
    expect(data.week.recent).toHaveLength(5);
    expect(data.week.recent[0]).toMatchObject({
      toolName: { nl: expect.any(String), en: expect.any(String) },
    });
  });

  it("answers the question box with at most three tools from the catalogue search", async () => {
    const data = await load("/start?q=toetsvragen+rubric+maken");
    expect(data.query).toBe("toetsvragen rubric maken");
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.length).toBeLessThanOrEqual(3);
    expect(data.results.map((r) => r.slug)).toContain("test-items");
  });

  it("keeps a chosen course only when it is the teacher's own", async () => {
    const mine = await courses.createCourse("teacher-a", { name: "Eigen", data: alignedCourse() });
    const theirs = await courses.createCourse("teacher-b", { name: "Niet", data: alignedCourse() });
    expect((await load(`/start?q=rubric&course=${mine.id}`)).course).toBe(mine.id);
    expect((await load(`/start?q=rubric&course=${theirs.id}`)).course).toBeNull();
  });

  it("leaves courses and findings out when courses are switched off", async () => {
    await courses.createCourse("teacher-a", { name: "Plan", data: gappyCourse() });
    await settings.setFeatureStand("courses", "off");
    try {
      const data = await load();
      expect(data.courses).toBeNull();
      expect(data.week.findings).toEqual([]);
    } finally {
      await settings.setFeatureStand("courses", "on");
    }
  });

  describe("the teacher's week (P22.3)", () => {
    /** A course that starts on Monday 16 November 2026, with a lesson and a quiz. */
    const datedCourse = () => ({
      ...alignedCourse(),
      startDate: "2026-11-16",
    });
    // Signs in again at the new time: the session would be idle for days otherwise.
    const at = async (iso: string) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(iso));
      await signInAs({ id: "dated", name: "D" });
    };

    it("is absent while no course has a start date, with a hint to the course", async () => {
      await signInAs({ id: "nodate", name: "N" });
      const c = await courses.createCourse("nodate", { name: "Zonder", data: alignedCourse() });
      const data = await load();
      expect(data.teacherWeek).toBeNull();
      expect(data.startDateHint).toEqual({ courseId: c.id });
    });

    it("computes this week from the own dated courses and links, never someone else's", async () => {
      await signInAs({ id: "dated", name: "D" });
      const mine = await courses.createCourse("dated", { name: "Datums", data: datedCourse() });
      await courses.createCourse("other", { name: "Van een ander", data: datedCourse() });
      await at("2026-11-18T10:00:00Z"); // Wednesday of week 1
      try {
        const data = await load();
        expect(data.startDateHint).toBeNull();
        const week = data.teacherWeek;
        expect(week?.now.isoWeek).toBe(47);
        expect(week?.now.courses.map((c) => c.courseId)).toEqual([mine.id]);
        expect(week?.next).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("adds next week on Friday in the institution's time zone", async () => {
      await signInAs({ id: "dated", name: "D" });
      // 23:30 UTC on Thursday is already Friday in Amsterdam.
      await at("2026-11-19T23:30:00Z");
      try {
        const data = await load();
        expect(data.teacherWeek?.next?.isoWeek).toBe(48);
      } finally {
        vi.useRealTimers();
      }
    });

    it("gives the week the course tools the teacher may use (P27.4)", async () => {
      await signInAs({ id: "dated", name: "D" });
      await settings.setToolStand("rubric-builder", "off");
      try {
        const data = await load();
        expect(data.teacherWeek?.tools.activity.map((t) => t.slug)).toContain("lesson-plan");
        expect(data.teacherWeek?.tools.assessment.map((t) => t.slug)).not.toContain(
          "rubric-builder",
        );
      } finally {
        await settings.setToolStand("rubric-builder", null);
      }
    });

    it("is absent when courses are switched off", async () => {
      await signInAs({ id: "dated", name: "D" });
      await settings.setFeatureStand("courses", "off");
      try {
        const data = await load();
        expect(data.teacherWeek).toBeNull();
        expect(data.startDateHint).toBeNull();
      } finally {
        await settings.setFeatureStand("courses", "on");
      }
    });
  });
});
