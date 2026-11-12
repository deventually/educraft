import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  detail = await import("~/routes/courses.$id");
});

beforeEach(() => signInAs({ id: "clw-a", name: "A" }));

const work = (toolSlug = "lesson-plan", stageId = "lesson") =>
  generations.saveGeneration({
    userId: "clw-a",
    toolSlug,
    stageId,
    input: {},
    outputMarkdown: "# Werk",
    model: "test",
    outputLanguage: "nl",
  });

const load = (id: string) =>
  detail.loader({
    request: signedRequest(`http://localhost/courses/${id}?tab=documents`),
    params: { id },
  } as never) as Promise<{ linkedWork: { generationId: string; asLesson?: boolean }[] }>;

function act(id: string, fields: Record<string, string>) {
  const request = signedRequest(`http://localhost/courses/${id}?tab=documents`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
  return detail.action({ request, params: { id } } as never);
}

describe("course page: kept work becomes a lesson", () => {
  it("offers it only for a lesson plan that is not at a lesson yet", async () => {
    const course = await courses.createCourse("clw-a", { name: "Offer" });
    const plan = await work();
    const rubric = await work("rubric-builder", "rubric");
    await courses.linkGeneration("clw-a", course.id, plan.id);
    await courses.linkGeneration("clw-a", course.id, rubric.id);
    const offered = (await load(course.id)).linkedWork.map((w) => [w.generationId, w.asLesson]);
    expect(offered).toEqual(
      expect.arrayContaining([
        [plan.id, true],
        [rubric.id, false],
      ]),
    );
  });

  it("adds kept work as a lesson from Gekoppeld werk", async () => {
    const course = await courses.createCourse("clw-a", { name: "Add" });
    const plan = await work();
    await courses.linkGeneration("clw-a", course.id, plan.id);
    const r = await act(course.id, { intent: "addAsLesson", id: plan.id, title: "Les 2" });
    const lesson = (await courses.getCourse("clw-a", course.id))?.data.activities[0];
    expect(lesson).toMatchObject({ title: "Les 2", kind: "lesson" });
    expect(r).toEqual({ ok: true, intent: "addAsLesson", itemId: lesson?.id });
    expect((await load(course.id)).linkedWork[0]?.asLesson).toBe(false);
  });

  it("refuses work that is not the caller's, with a message", async () => {
    const course = await courses.createCourse("clw-a", { name: "Refuse" });
    const r = await act(course.id, { intent: "addAsLesson", id: "nope", title: "Les" });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/les/i) });
  });
});
