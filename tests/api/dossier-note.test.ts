import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInAs, signedRequest } from "../helpers/session";
import { documentedCourse, TEST1 } from "../courses/fixtures";

process.env.DATABASE_URL = "file::memory:";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));

const NUMBERS = [
  "| Vraag | Max | p | Rit | Rir |",
  "| --- | --- | --- | --- | --- |",
  "| V1 | 1 | 0,82 | 0,41 | 0,33 |",
  "| V2 | 1 | 0,25 | 0,10 | -0,08 |",
].join("\n");

let courses: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let page: typeof import("~/routes/courses.$id.assessments.$assessmentId.note");
let courseId = "";

beforeAll(async () => {
  courses = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  page = await import("~/routes/courses.$id.assessments.$assessmentId.note");
  await signInAs({ id: "dn-b" });
  await signInAs({ id: "dn-a" });
  courseId = (await courses.createCourse("dn-a", { name: "Databases", data: documentedCourse() }))
    .id;
  const g = await generations.saveGeneration({
    userId: "dn-a",
    toolSlug: "test-analysis",
    model: "m",
    input: { analysis: NUMBERS, testInfo: "Kennistoets, 2 vragen." },
    outputLanguage: "nl",
    outputMarkdown: "Vraag 2 had een p-waarde van 0,15.",
  });
  await courses.linkGeneration("dn-a", courseId, g.id, TEST1);
});

beforeEach(async () => {
  generate.mockReset();
  await signInAs({ id: "dn-a" });
});

const url = (assessmentId = TEST1, id = courseId) =>
  `http://localhost/courses/${id}/assessments/${assessmentId}/note`;

const load = (assessmentId = TEST1, id = courseId) =>
  page.loader({
    request: signedRequest(url(assessmentId, id), { headers: { Cookie: "lang=nl" } }),
    params: { id, assessmentId },
  } as never);

const post = (fields: Record<string, string>, assessmentId = TEST1, id = courseId) =>
  page.action({
    request: signedRequest(url(assessmentId, id), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id, assessmentId },
  } as never);

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const savedNote = async () =>
  (await courses.getCourse("dn-a", courseId))?.data.assessments.find((a) => a.id === TEST1)
    ?.analysisNote;

describe("the note page of a test dossier (P35.2)", () => {
  it("shows the test, the caller's own linked numbers and the saved note", async () => {
    const data = await load();
    expect(data.assessment).toMatchObject({ id: TEST1, title: "Eindopdracht" });
    expect(data.analysis).toBe(NUMBERS);
    expect(data.note).toBe("");
  });

  it("is a 404 for a test that is not in the course, and for someone else's course", async () => {
    expect(await status(load("gone"))).toBe(404);
    await signInAs({ id: "dn-b" });
    expect(await status(load())).toBe(404);
    expect(await status(post({ intent: "save-note", note: "Van mij." }))).toBe(404);
  });

  it("saves the teacher's own note on the test, and an empty note removes it", async () => {
    expect(await post({ intent: "save-note", note: "  Vraag 2 herschrijf ik.  " })).toEqual({
      ok: true,
      intent: "save-note",
    });
    expect(await savedNote()).toBe("Vraag 2 herschrijf ik.");
    expect((await load()).note).toBe("Vraag 2 herschrijf ik.");
    await post({ intent: "save-note", note: "" });
    expect(await savedNote()).toBeUndefined();
  });

  it("refuses a note that is too long", async () => {
    expect(await post({ intent: "save-note", note: "x".repeat(5_000) })).toMatchObject({
      ok: false,
      intent: "save-note",
    });
  });

  it("drafts a concept from the linked numbers, without numbers that are not in them, and saves nothing", async () => {
    generate.mockResolvedValue({
      text: JSON.stringify({
        draft: "Vraag 2 had een p-waarde van 0,15. De Rir van vraag 2 is -0,08.",
        questions: ["Wat ga jij aan vraag 2 veranderen?"],
      }),
    });
    const r = await post({ intent: "draft-note" });
    expect(r).toEqual({
      ok: true,
      intent: "draft-note",
      note: {
        draft: "De Rir van vraag 2 is -0,08.",
        questions: ["Wat ga jij aan vraag 2 veranderen?"],
        dropped: 1,
      },
    });
    const sent = generate.mock.calls[0]![0].messages[0].content as string;
    expect(sent).toContain("| V2 | 1 | 0,25 | 0,10 | -0,08 |");
    expect(sent).toContain("Kennistoets, 2 vragen.");
    expect(generate.mock.calls[0]![0].system).toContain("Voice & Bounds");
    expect(await savedNote()).toBeUndefined();
  });

  it("says so when the answer stays unreadable, after one retry", async () => {
    generate.mockResolvedValue({ text: "nope" });
    expect(await post({ intent: "draft-note" })).toEqual({
      ok: false,
      intent: "draft-note",
      error: "Het concept lukte niet. Probeer het nog een keer.",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("drafts nothing without a linked analysis", async () => {
    const other = await courses.createCourse("dn-a", { name: "Leeg", data: documentedCourse() });
    expect(await post({ intent: "draft-note" }, TEST1, other.id)).toEqual({
      ok: false,
      intent: "draft-note",
      error:
        "Koppel eerst een toetsanalyse aan deze toets: dan kan LimeOnIt een concept schrijven.",
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
