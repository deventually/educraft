import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ACT1, alignedCourse, TEST1 } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota, selectable } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "eval-a", name: "A", email: null, role: "teacher" } as never },
  quota: { ok: true },
  selectable: new Set(["claude-sonnet-5-5", "claude-opus-5-5"]),
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/server/repositories/usage.server", () => ({
  checkQuota: vi.fn(async () => ({ ok: quota.ok })),
  recordUsage: vi.fn(async () => {}),
}));
vi.mock("~/server/availability.server", () => ({
  effectiveDefaultModel: vi.fn(async () => "claude-sonnet-5-5"),
  isModelSelectableForUser: vi.fn(async (_u: unknown, m: string) => selectable.has(m)),
  getAvailableTools: vi.fn(async () => []),
  requireFeature: vi.fn(async () => {}),
  isFeatureOn: vi.fn(async () => true),
}));

let repo: typeof import("~/server/repositories/courses.server");
let generations: typeof import("~/server/repositories/generations.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  generations = await import("~/server/repositories/generations.server");
  detail = await import("~/routes/courses.$id");
  const users = await import("~/server/repositories/users.server");
  await users.createUser({ id: "eval-a", name: "A", passwordHash: "x", role: "teacher" });
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
});

function post(id: string, fields: Record<string, string>) {
  return detail.action({
    request: new Request(`http://localhost/courses/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: "lang=nl" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: { id },
  } as never);
}

const SURVEY =
  "Normaliseren ging te snel.\nDe les over normaliseren was te snel.\nFijne eindopdracht.";
const ANSWER = JSON.stringify({
  themes: [
    {
      label: "Tempo normaliseren",
      polarity: "negative",
      count: 2,
      quotes: ["Normaliseren ging te snel.", "Dit staat er niet."],
    },
  ],
  problems: [{ place: ACT1, text: "Te hoog tempo.", basis: "students" }],
  improvements: [{ place: ACT1, text: "Spreid normaliseren over twee lessen." }],
});

describe("the course page's evaluate-course intent (P33.2)", () => {
  it("returns the checked evaluation, on the chosen model, and saves nothing", async () => {
    const course = await repo.createCourse("eval-a", { name: "Databases", data: alignedCourse() });
    generate.mockResolvedValue({ text: ANSWER });
    const r = await post(course.id, {
      intent: "evaluate-course",
      evaluation: SURVEY,
      respondents: "12",
      model: "claude-opus-5-5",
    });
    expect(r).toEqual({
      ok: true,
      intent: "evaluate-course",
      evaluation: {
        respondents: 12,
        small: false,
        themes: [
          {
            label: "Tempo normaliseren",
            polarity: "negative",
            count: 2,
            quotes: ["Normaliseren ging te snel."],
          },
        ],
        problems: [
          { place: { kind: "activity", id: ACT1 }, text: "Te hoog tempo.", basis: "students" },
        ],
        improvements: [
          { place: { kind: "activity", id: ACT1 }, text: "Spreid normaliseren over twee lessen." },
        ],
      },
    });
    const call = generate.mock.calls[0]![0];
    expect(call.model).toBe("claude-opus-5-5");
    expect(call.messages[0].content).toContain("<respondents>12</respondents>");
    expect(call.messages[0].content).toContain(SURVEY);
    expect((await repo.getCourse("eval-a", course.id))?.data).toEqual(alignedCourse());
  });

  it("sends the test analysis linked to one of the course's tests", async () => {
    const course = await repo.createCourse("eval-a", { name: "Toetsen", data: alignedCourse() });
    const g = await generations.saveGeneration({
      userId: "eval-a",
      toolSlug: "test-analysis",
      model: "m",
      input: { analysis: "Vraag 3: p = 0,21; Rir = -0,05" },
      outputLanguage: "nl",
      outputMarkdown: "x",
    });
    await repo.linkGeneration("eval-a", course.id, g.id, TEST1);
    generate.mockResolvedValue({ text: ANSWER });
    await post(course.id, { intent: "evaluate-course", evaluation: SURVEY, respondents: "12" });
    expect(generate.mock.calls[0]![0].messages[0].content).toMatch(
      /<testAnalysis>\n## Eindopdracht\nVraag 3: p = 0,21; Rir = -0,05/,
    );
  });

  it("retries once on an unreadable answer, then says it failed", async () => {
    const course = await repo.createCourse("eval-a", { name: "Logica", data: alignedCourse() });
    generate.mockResolvedValueOnce({ text: "nope" }).mockResolvedValueOnce({ text: ANSWER });
    expect(
      await post(course.id, { intent: "evaluate-course", evaluation: SURVEY, respondents: "3" }),
    ).toMatchObject({ ok: true, evaluation: { small: true } });
    generate.mockReset();
    generate.mockResolvedValue({ text: "nope" });
    expect(
      await post(course.id, { intent: "evaluate-course", evaluation: SURVEY, respondents: "3" }),
    ).toEqual({
      ok: false,
      intent: "evaluate-course",
      error: "Het verwerken lukte niet. Probeer het nog een keer.",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("refuses empty input, a bad count, an unknown model and an empty quota, without a call", async () => {
    const course = await repo.createCourse("eval-a", { name: "Kansen", data: alignedCourse() });
    const error = async (fields: Record<string, string>) =>
      ((await post(course.id, { intent: "evaluate-course", ...fields })) as { error: string })
        .error;
    expect(await error({ evaluation: " ", respondents: "5" })).toBe(
      "Plak de antwoorden en vul het aantal respondenten in.",
    );
    expect(await error({ evaluation: SURVEY, respondents: "0" })).toBe(
      "Plak de antwoorden en vul het aantal respondenten in.",
    );
    expect(await error({ evaluation: SURVEY, respondents: "5", model: "gpt-x" })).toBe(
      "Dit model kun je niet kiezen.",
    );
    quota.ok = false;
    expect(await error({ evaluation: SURVEY, respondents: "5" })).toMatch(/limiet/);
    expect(generate).not.toHaveBeenCalled();
  });
});
