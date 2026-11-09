import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { alignedCourse, LO1 } from "../courses/fixtures";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota, recordUsage } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-i", name: "I", email: null, role: "teacher" } as never },
  quota: { ok: true },
  recordUsage: vi.fn(async () => {}),
}));
vi.mock("~/lib/ai/provider", () => ({ providerForModel: () => ({ id: "fake", generate }) }));
vi.mock("~/server/auth.server", () => ({
  requireUser: vi.fn(async () => currentUser.value),
  requireRole: vi.fn(async () => currentUser.value),
}));
vi.mock("~/server/repositories/usage.server", () => ({
  checkQuota: vi.fn(async () => ({ ok: quota.ok })),
  recordUsage,
}));
vi.mock("~/server/availability.server", () => ({
  effectiveDefaultModel: vi.fn(async () => "claude-sonnet-5-5"),
  getAvailableTools: vi.fn(async () => []),
  requireFeature: vi.fn(async () => undefined),
}));

let repo: typeof import("~/server/repositories/courses.server");
let detail: typeof import("~/routes/courses.$id");

beforeAll(async () => {
  repo = await import("~/server/repositories/courses.server");
  detail = await import("~/routes/courses.$id");
});

beforeEach(() => {
  generate.mockReset();
  recordUsage.mockClear();
  quota.ok = true;
});

function post(id: string, fields: [string, string][], locale = "nl") {
  const body = new URLSearchParams(fields);
  const request = new Request(`http://localhost/courses/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: `lang=${locale}` },
    body: body.toString(),
  });
  return detail.action({ request, params: { id } } as never);
}

async function status(p: Promise<unknown>): Promise<number | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    return e instanceof Response ? e.status : -1;
  }
}

const DOC = `Studiehandleiding Databases (fictief)
1. Je schrijft SQL-queries met joins.
2. Je begrijpt transacties.
Tentamen, week 8, weging 100%`;

const answer = JSON.stringify({
  outcomes: [
    { text: "Je schrijft SQL-queries met joins.", bloomProposal: "apply" },
    { text: "Je beheert een databaseserver.", bloomProposal: "apply" },
  ],
  assessments: [{ title: "Tentamen", kind: "summative", weight: 100, week: 8, outcomeRefs: [1] }],
  notes: null,
});

describe("import-extract", () => {
  it("returns a proposal without saving, flags what is not in the document, counts usage", async () => {
    const course = await repo.createCourse("teacher-i", { name: "Databases" });
    generate.mockResolvedValueOnce({ text: answer, usage: { output: 80 } });
    const r = await post(course.id, [
      ["intent", "import-extract"],
      ["documentText", DOC],
      ["courseName", "Databases"],
    ]);
    if (!r.ok || r.intent !== "import-extract") throw new Error(JSON.stringify(r));
    expect(r.flagged).toBe(1);
    expect(r.proposal.outcomes.map((o) => o.verbatim)).toEqual([true, false]);
    expect(r.proposal.assessments[0]).toMatchObject({ title: "Tentamen", outcomeKeys: ["o1"] });
    expect((await repo.getCourse("teacher-i", course.id))?.data.outcomes).toEqual([]);
    expect(recordUsage).toHaveBeenCalledOnce();
    const call = generate.mock.calls[0]![0];
    expect(call.model).toBe("claude-sonnet-5-5");
    expect(call.system).toContain("Voice & Bounds");
    expect(call.messages[0].content).toContain("<document>");
    expect(call.messages[0].content).toContain("<course>Databases</course>");
    expect(call.temperature).toBe(0);
  });

  it("retries once on broken JSON, then gives a localized failure", async () => {
    const course = await repo.createCourse("teacher-i", { name: "Retry" });
    generate.mockResolvedValueOnce({ text: "{ kapot" }).mockResolvedValueOnce({ text: answer });
    const ok = await post(course.id, [
      ["intent", "import-extract"],
      ["documentText", DOC],
    ]);
    expect(ok.ok).toBe(true);
    expect(generate).toHaveBeenCalledTimes(2);
    generate.mockReset();
    generate.mockResolvedValue({ text: "{ kapot" });
    const failed = await post(
      course.id,
      [
        ["intent", "import-extract"],
        ["documentText", DOC],
      ],
      "en",
    );
    expect(failed).toMatchObject({ ok: false });
    expect(generate).toHaveBeenCalledTimes(2);
    if (failed.ok) throw new Error("expected a failure");
    expect(failed.error).toMatch(/could not/i);
  });

  it("says why when the document has nothing to import, without a pointless retry", async () => {
    // A domain description or an OER without course outcomes is not an error
    // to retry: the model explains it in `notes`, and the teacher reads that.
    const course = await repo.createCourse("teacher-i", { name: "Leeg" });
    const why = "Dit is een domeinbeschrijving, geen OER: er staan geen vakken in.";
    generate.mockResolvedValue({
      text: JSON.stringify({ outcomes: [], assessments: [], notes: why }),
    });
    const r = await post(course.id, [
      ["intent", "import-extract"],
      ["documentText", DOC],
    ]);
    expect(generate).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: false, intent: "import-extract", notes: why });
    if (r.ok) throw new Error("expected nothing found");
    expect(r.error).toMatch(/geen leeruitkomsten of toetsen/);
  });

  it("refuses an empty document and a teacher over the quota, without a model call", async () => {
    const course = await repo.createCourse("teacher-i", { name: "Gates" });
    expect(
      await post(course.id, [
        ["intent", "import-extract"],
        ["documentText", "  "],
      ]),
    ).toMatchObject({
      ok: false,
    });
    quota.ok = false;
    expect(
      await post(course.id, [
        ["intent", "import-extract"],
        ["documentText", DOC],
      ]),
    ).toMatchObject({
      ok: false,
    });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("import-apply", () => {
  it("adds the ticked items and never duplicates on a second import", async () => {
    const course = await repo.createCourse("teacher-i", { name: "Apply", data: alignedCourse() });
    const fields: [string, string][] = [
      ["intent", "import-apply"],
      ["outcomeKey", "o1"],
      ["o1.pick", "on"],
      ["o1.text", "Je ontwerpt een datamodel."],
      ["outcomeKey", "o2"],
      ["o2.pick", "on"],
      ["o2.text", "Je schrijft SQL-queries met joins."],
      ["o2.bloom", "apply"],
      ["assessmentKey", "a1"],
      ["a1.pick", "on"],
      ["a1.title", "Tentamen"],
      ["a1.kind", "summative"],
      ["a1.week", "8"],
      ["a1.outcomes", "o1"],
      ["a1.outcomes", "o2"],
    ];
    const r = await post(course.id, fields);
    expect(r).toMatchObject({
      ok: true,
      intent: "import-apply",
      added: { outcomes: 1, assessments: 1 },
    });
    const saved = await repo.getCourse("teacher-i", course.id);
    expect(saved?.data.outcomes).toHaveLength(3);
    const sql = saved?.data.outcomes[2];
    expect(sql).toMatchObject({ text: "Je schrijft SQL-queries met joins.", bloom: "apply" });
    const tentamen = saved?.data.assessments.find((a) => a.title === "Tentamen");
    expect(tentamen?.coverage.map((c) => c.outcomeId)).toEqual([LO1, sql?.id]);

    expect(await post(course.id, fields)).toMatchObject({
      ok: true,
      added: { outcomes: 0, assessments: 0 },
    });
    expect((await repo.getCourse("teacher-i", course.id))?.data).toEqual(saved?.data);
  });

  it("refuses a manipulated payload and saves nothing", async () => {
    const course = await repo.createCourse("teacher-i", { name: "Bad", data: alignedCourse() });
    const r = await post(course.id, [
      ["intent", "import-apply"],
      ["assessmentKey", "a1"],
      ["a1.pick", "on"],
      ["a1.title", "Tentamen"],
      ["a1.kind", "summative"],
      ["a1.outcomes", "o9"],
    ]);
    expect(r).toMatchObject({ ok: false });
    expect((await repo.getCourse("teacher-i", course.id))?.data).toEqual(alignedCourse());
  });

  it("is a 404 for someone else's course, for both intents", async () => {
    const theirs = await repo.createCourse("teacher-other", { name: "Niet van jou" });
    expect(
      await status(
        post(theirs.id, [
          ["intent", "import-extract"],
          ["documentText", DOC],
        ]),
      ),
    ).toBe(404);
    expect(
      await status(
        post(theirs.id, [
          ["intent", "import-apply"],
          ["outcomeKey", "o1"],
          ["o1.pick", "on"],
          ["o1.text", "X"],
        ]),
      ),
    ).toBe(404);
    expect(generate).not.toHaveBeenCalled();
  });
});
