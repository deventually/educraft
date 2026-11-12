import { beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file::memory:";

let lessons: typeof import("~/server/lessonFromWork.server");
let courses: typeof import("~/server/repositories/courses.server");
let gens: typeof import("~/server/repositories/generations.server");

const A = "lesson-work-a";
const B = "lesson-work-b";

beforeAll(async () => {
  lessons = await import("~/server/lessonFromWork.server");
  courses = await import("~/server/repositories/courses.server");
  gens = await import("~/server/repositories/generations.server");
});

const lessonPlan = (userId: string, toolSlug = "lesson-plan", stageId = "lesson") =>
  gens.saveGeneration({
    userId,
    toolSlug,
    stageId,
    model: "test",
    input: { learningGoal: "De student berekent de intrinsieke waarde.", content: "Gordon" },
    outputLanguage: "nl",
    outputMarkdown: "# Lesopzet",
  });

describe("addWorkAsLesson", () => {
  it("adds a lesson to the course plan and keeps the work at it", async () => {
    const course = await courses.createCourse(A, { name: "Finance" });
    const work = await lessonPlan(A);
    const done = await lessons.addWorkAsLesson(A, {
      courseId: course.id,
      generationId: work.id,
      title: "  Les 3: aandelen waarderen  ",
    });
    expect(done).not.toBeNull();
    const saved = await courses.getCourse(A, course.id);
    expect(saved?.data.activities).toEqual([
      {
        id: done?.itemId,
        title: "Les 3: aandelen waarderen",
        kind: "lesson",
        goal: "De student berekent de intrinsieke waarde.",
        outcomeIds: [],
      },
    ]);
    const linked = await courses.listLinkedWork(A, course.id);
    expect(linked.map((l) => [l.generationId, l.itemId])).toEqual([[work.id, done?.itemId]]);
  });

  it("refuses an empty title, someone else's course or work, and work that is no lesson", async () => {
    const course = await courses.createCourse(A, { name: "Refusals" });
    const mine = await lessonPlan(A);
    const add = (userId: string, generationId: string, title = "Les", courseId = course.id) =>
      lessons.addWorkAsLesson(userId, { courseId, generationId, title });

    expect(await add(A, mine.id, "   ")).toBeNull();
    expect(await add(B, mine.id)).toBeNull();
    expect(await add(A, (await lessonPlan(B)).id)).toBeNull();
    expect(await add(A, (await lessonPlan(A, "test-items", "blueprint")).id)).toBeNull();
    expect(await add(A, mine.id, "Les", "no-such-course")).toBeNull();
    expect((await courses.getCourse(A, course.id))?.data.activities).toEqual([]);
  });
});
