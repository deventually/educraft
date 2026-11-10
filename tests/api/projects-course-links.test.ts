import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { alignedCourse, TEST1 } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

let courses: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let projects: typeof import("~/routes/projects._index");
let m: ReturnType<typeof import("~/lib/i18n").getMessages>;

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  projects = await import("~/routes/projects._index");
  m = (await import("~/lib/i18n")).getMessages("nl");
});

beforeEach(() => signInAs({ id: "work-a", name: "A" }));

function post(fields: Record<string, string>): Request {
  return signedRequest("http://localhost/projects", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
    body: new URLSearchParams(fields).toString(),
  });
}

const act = (fields: Record<string, string>) => projects.action({ request: post(fields) } as never);

const generation = (userId = "work-a") =>
  generations.saveGeneration({
    userId,
    toolSlug: "authentic-assessment",
    input: {},
    outputMarkdown: "# Toets",
    model: "test",
    outputLanguage: "nl",
  } as never);

describe("/projects — link to a course (P20, 20.4)", () => {
  it("links a generation to an item of an own course, shows it, and unlinks it", async () => {
    const course = await courses.createCourse("work-a", {
      name: "SE jaar 2",
      data: alignedCourse(),
    });
    const g = await generation();

    expect(await act({ intent: "linkCourse", id: g.id, target: `${course.id}::${TEST1}` })).toEqual(
      {
        ok: true,
        intent: "linkCourse",
      },
    );

    const data = (await projects.loader({
      request: signedRequest("http://localhost/projects"),
    } as never)) as {
      generations: { id: string; courseLinks: unknown[] }[];
      courses: { courseId: string; courseName: string }[];
    };
    expect(data.courses.map((c) => c.courseName)).toContain("SE jaar 2");
    expect(data.generations.find((x) => x.id === g.id)?.courseLinks).toEqual([
      { courseId: course.id, courseName: "SE jaar 2", itemTitle: "Eindopdracht" },
    ]);

    expect(await act({ intent: "unlinkCourse", id: g.id, courseId: course.id })).toEqual({
      ok: true,
      intent: "unlinkCourse",
    });
    expect(await courses.listLinksForCourse("work-a", course.id)).toEqual([]);
  });

  it("refuses someone else's course, an unknown item and a malformed target", async () => {
    const theirs = await courses.createCourse("work-b", { name: "B" });
    const mine = await courses.createCourse("work-a", { name: "A", data: alignedCourse() });
    const g = await generation();
    const refused = { ok: false, error: m.courses.links.errorRefused };
    expect(await act({ intent: "linkCourse", id: g.id, target: theirs.id })).toEqual(refused);
    expect(await act({ intent: "linkCourse", id: g.id, target: `${mine.id}::nope` })).toEqual(
      refused,
    );
    expect(await act({ intent: "linkCourse", id: g.id, target: "" })).toEqual(refused);
  });

  it("refuses to link someone else's generation", async () => {
    const mine = await courses.createCourse("work-a", { name: "A" });
    const theirs = await generation("work-b");
    expect(await act({ intent: "linkCourse", id: theirs.id, target: mine.id })).toEqual({
      ok: false,
      error: m.courses.links.errorRefused,
    });
  });
});
