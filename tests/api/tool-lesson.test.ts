import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let toolRoute: typeof import("~/routes/tool");
let generations: typeof import("~/server/repositories/generations.server");
let courses: typeof import("~/server/repositories/courses.server");

beforeAll(async () => {
  toolRoute = await import("~/routes/tool");
  generations = await import("~/server/repositories/generations.server");
  courses = await import("~/server/repositories/courses.server");
});

beforeEach(() => signInAs({ id: "tl-a" }));

function act(fields: Record<string, string>) {
  const request = signedRequest("http://localhost/tools/lesson-plan", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
  return toolRoute.action({ request, params: { slug: "lesson-plan" }, context: {} } as never);
}

describe("tool action: addAsLesson", () => {
  it("adds the lesson plan as a lesson of the course and returns where it is", async () => {
    const course = await courses.createCourse("tl-a", { name: "Finance" });
    const work = await generations.saveGeneration({
      userId: "tl-a",
      toolSlug: "lesson-plan",
      stageId: "lesson",
      input: {},
      outputMarkdown: "# Lesopzet",
      model: "test",
      outputLanguage: "nl",
    });
    const result = await act({
      intent: "addAsLesson",
      id: work.id,
      courseId: course.id,
      title: "Les 1",
    });
    const item = (await courses.getCourse("tl-a", course.id))?.data.activities[0];
    expect(item?.title).toBe("Les 1");
    expect(result).toEqual({ ok: true, intent: "addAsLesson", itemId: item?.id });
  });

  it("says so when it is refused", async () => {
    const result = await act({ intent: "addAsLesson", id: "nope", courseId: "nope", title: "x" });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/les/i) });
  });
});
