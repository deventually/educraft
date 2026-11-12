import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C1, C2, LU, sampleDossier } from "../portfolio/fixtures";
import type { DossierData } from "~/lib/portfolio/types";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-g", name: "G", email: null, role: "teacher" } as never },
  quota: { ok: true },
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
  getAvailableTools: vi.fn(async () => []),
  effectiveFeatures: vi.fn(async () => ({ portfolio: { on: true, source: "default" } })),
}));

let guided: typeof import("~/server/portfolioGuided.server");
let repo: typeof import("~/server/repositories/portfolio.server");
let outcomeRoute: typeof import("~/routes/portfolio.$id.outcome.$outcomeId");

beforeAll(async () => {
  guided = await import("~/server/portfolioGuided.server");
  repo = await import("~/server/repositories/portfolio.server");
  outcomeRoute = await import("~/routes/portfolio.$id.outcome.$outcomeId");
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
});

const user = { id: "teacher-g", name: "G", email: null, role: "teacher" } as never;

/** Confirmed, with the form's outline: s1 covers C2, s2 covers C1. */
function dossier(patch: Partial<DossierData> = {}): DossierData {
  const d = sampleDossier();
  const [o] = d.framework.outcomes;
  return {
    ...d,
    framework: {
      ...d.framework,
      confirmedAt: 1,
      outcomes: [
        {
          ...o!,
          outline: [
            { id: "s1", title: "Beginsituatie", criterionIds: [C2] },
            { id: "s2", title: "Opbouw van de les", criterionIds: [C1] },
          ],
        },
      ],
    },
    ...patch,
  };
}

const questions = JSON.stringify({
  questions: ["Welke groep had je?", "Wat konden ze al?", "Hoe wist je dat?"],
});

function asked(d: DossierData): DossierData {
  return {
    ...d,
    guided: {
      [LU]: {
        s1: {
          questions: ["Welke groep had je?", "Wat konden ze al?"],
          answers: ["Tweedejaars, 24 studenten.", ""],
          at: 1,
          model: "claude-sonnet-5-5",
        },
      },
    },
  };
}

describe("askQuestions", () => {
  it("needs a confirmed framework and respects the quota, without calling the model", async () => {
    const open = dossier();
    open.framework = { ...open.framework, confirmedAt: undefined };
    expect(await guided.askQuestions(user, open, LU, "s1", "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    quota.ok = false;
    expect(await guided.askQuestions(user, dossier(), LU, "s1", "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("stores the checked questions for the section and logs the AI use as coaching", async () => {
    generate.mockResolvedValueOnce({ text: questions });
    const r = await guided.askQuestions(user, dossier(), LU, "s1", "nl", 9);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.guided?.[LU]?.s1).toEqual({
      questions: ["Welke groep had je?", "Wat konden ze al?", "Hoe wist je dat?"],
      answers: [],
      at: 9,
      model: "claude-sonnet-5-5",
    });
    expect(r.data.aiLog.at(-1)).toEqual({
      at: 9,
      action: "review",
      outcomeId: LU,
      model: "claude-sonnet-5-5",
    });
    const call = generate.mock.calls[0]![0];
    expect(call.system).toContain("Voice & Bounds");
    expect(call.messages[0].content).toContain("Beginsituatie");
    expect(call.temperature).toBe(0);
    // Asking never writes chapter text.
    expect(r.data.chapters).toEqual(dossier().chapters);
  });

  it("retries once on an unusable answer, then gives up", async () => {
    generate.mockResolvedValue({ text: "Geen JSON." });
    expect(await guided.askQuestions(user, dossier(), LU, "s1", "nl")).toEqual({
      ok: false,
      error: "failed",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe("draftSection", () => {
  it("only works when the teacher chose paragraphs too", async () => {
    expect(await guided.draftSection(user, asked(dossier()), LU, "s1", "", "nl")).toEqual({
      ok: false,
      error: "not-draft-mode",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("needs an answer or linked evidence for the section", async () => {
    const d = dossier({ coachMode: "draft" });
    expect(await guided.draftSection(user, d, LU, "s1", "", "nl")).toEqual({
      ok: false,
      error: "no-material",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("appends the paragraph under the section's title to the current text, and logs it", async () => {
    generate.mockResolvedValueOnce({
      text: "Mijn groep waren 24 tweedejaars. [aanvullen: wat ze al konden]",
    });
    const d = asked(dossier({ coachMode: "draft" }));
    const r = await guided.draftSection(user, d, LU, "s1", "Niet opgeslagen tekst.", "nl", 11);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.chapters[0]).toMatchObject({
      text: "Niet opgeslagen tekst.\n\n## Beginsituatie\n\nMijn groep waren 24 tweedejaars. [aanvullen: wat ze al konden]",
      aiDrafted: true,
    });
    expect(r.data.aiLog.at(-1)).toMatchObject({ action: "draft", at: 11, outcomeId: LU });
    const call = generate.mock.calls[0]![0];
    expect(call.system).toContain("aanvullen");
    expect(call.messages[0].content).toContain("Tweedejaars, 24 studenten.");
    expect(call.messages[0].content).toContain("Niet opgeslagen tekst.");
  });

  it("works from evidence alone, as the old paragraph per criterion did", async () => {
    generate.mockResolvedValueOnce({ text: "Mijn les had een duidelijke opbouw." });
    const d = dossier({ coachMode: "draft" });
    const r = await guided.draftSection(user, d, LU, "s2", "", "nl");
    expect(r.ok).toBe(true);
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("Goede opbouw.");
  });

  it("retries once when the paragraph cites a source the teacher does not have", async () => {
    generate
      .mockResolvedValueOnce({ text: "Volgens Hattie (2009) werkt dit." })
      .mockResolvedValueOnce({ text: "Dit werkte in mijn klas." });
    const r = await guided.draftSection(
      user,
      asked(dossier({ coachMode: "draft" })),
      LU,
      "s1",
      "",
      "nl",
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.data.chapters[0]?.text).toContain("Dit werkte in mijn klas.");
    expect(r.data.chapters[0]?.text).not.toContain("Hattie");
    // The second try is told which source to leave out.
    expect(generate.mock.calls[1]![0].messages[0].content).toContain("Hattie (2009)");
  });
});

describe("the whole chapter at once", () => {
  it("asks the questions of every section that has none, keeping the ones already asked", async () => {
    generate.mockResolvedValueOnce({ text: questions });
    const both = { ...dossier(), guided: undefined };
    const r = await guided.askAllQuestions(user, asked(dossier()), LU, "nl", 5);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.guided?.[LU]?.s1?.questions).toEqual([
      "Welke groep had je?",
      "Wat konden ze al?",
    ]);
    expect(r.data.guided?.[LU]?.s1?.answers).toEqual(["Tweedejaars, 24 studenten.", ""]);
    expect(r.data.guided?.[LU]?.s2?.questions).toHaveLength(3);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("Opbouw van de les");

    generate.mockReset();
    generate.mockResolvedValue({ text: questions });
    const all = await guided.askAllQuestions(user, both, LU, "nl", 5);
    if (!all.ok) throw new Error(all.error);
    expect(Object.keys(all.data.guided?.[LU] ?? {})).toEqual(["s1", "s2"]);
    expect(all.data.aiLog.filter((e) => e.action === "review")).toHaveLength(2);
  });

  it("respects the quota and the confirmed framework, without calling the model", async () => {
    const open = dossier();
    open.framework = { ...open.framework, confirmedAt: undefined };
    expect(await guided.askAllQuestions(user, open, LU, "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    quota.ok = false;
    expect(await guided.askAllQuestions(user, dossier(), LU, "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("keeps the sections that got questions when another one fails", async () => {
    generate.mockImplementation(async ({ messages }) => ({
      text: String(messages[0].content).includes("Opbouw van de les") ? "Geen JSON." : questions,
    }));
    const r = await guided.askAllQuestions(user, dossier(), LU, "nl");
    if (!r.ok) throw new Error(r.error);
    expect(r.data.guided?.[LU]?.s1?.questions).toHaveLength(3);
    expect(r.data.guided?.[LU]?.s2).toBeUndefined();
    expect(r.failed).toBe(1);
  });

  it("drafts the sections one by one, in order, each after the text before it", async () => {
    generate
      .mockResolvedValueOnce({ text: "Ik had 24 tweedejaars." })
      .mockResolvedValueOnce({ text: "Mijn les had een duidelijke opbouw." });
    const d = asked(dossier({ coachMode: "draft" }));
    const r = await guided.draftChapter(user, d, LU, "Begin.", "nl", 7);
    if (!r.ok) throw new Error(r.error);
    expect(r.drafted).toBe(2);
    expect(r.data.chapters[0]?.text).toBe(
      "Begin.\n\n## Beginsituatie\n\nIk had 24 tweedejaars.\n\n## Opbouw van de les\n\nMijn les had een duidelijke opbouw.",
    );
    // The second section is written knowing what the first one says.
    expect(generate.mock.calls[1]![0].messages[0].content).toContain("Ik had 24 tweedejaars.");
    expect(generate.mock.calls[1]![0].messages[0].content).toContain("Goede opbouw.");
    expect(r.data.guided?.[LU]?.s1?.draftedAt).toBe(7);
    expect(r.data.aiLog.filter((e) => e.action === "draft")).toHaveLength(2);
  });

  it("skips sections already written and sections without material", async () => {
    generate.mockResolvedValue({ text: "Nieuwe tekst." });
    const d = asked(dossier({ coachMode: "draft", evidence: [] }));
    const written = {
      ...d,
      guided: { [LU]: { ...d.guided![LU]!, s1: { ...d.guided![LU]!.s1!, draftedAt: 3 } } },
    };
    expect(await guided.draftChapter(user, written, LU, "", "nl")).toEqual({
      ok: false,
      error: "all-drafted",
    });
    expect(
      await guided.draftChapter(user, dossier({ coachMode: "draft", evidence: [] }), LU, "", "nl"),
    ).toEqual({
      ok: false,
      error: "no-material",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("keeps what was written when a later section fails, and counts it", async () => {
    generate
      .mockResolvedValueOnce({ text: "Ik had 24 tweedejaars." })
      .mockResolvedValue({ text: "" });
    const r = await guided.draftChapter(user, asked(dossier({ coachMode: "draft" })), LU, "", "nl");
    if (!r.ok) throw new Error(r.error);
    expect(r).toMatchObject({ drafted: 1, failed: 1 });
    expect(r.data.chapters[0]?.text).toBe("## Beginsituatie\n\nIk had 24 tweedejaars.");
  });

  it("only drafts in draft mode", async () => {
    expect(await guided.draftChapter(user, asked(dossier()), LU, "", "nl")).toEqual({
      ok: false,
      error: "not-draft-mode",
    });
  });

  it("marks a section drafted on its own button too", async () => {
    generate.mockResolvedValueOnce({ text: "Ik had eerstejaars." });
    const r = await guided.draftSection(
      user,
      asked(dossier({ coachMode: "draft" })),
      LU,
      "s1",
      "",
      "nl",
      4,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.data.guided?.[LU]?.s1?.draftedAt).toBe(4);
  });
});

describe("outcome route — guided writing", () => {
  function post(fields: [string, string][]) {
    return new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }
  const load = (id: string) =>
    outcomeRoute.loader({
      request: new Request("http://localhost/x?tab=chapter"),
      params: { id, outcomeId: LU },
    } as never);

  it("asks the questions, keeps the chapter typed so far, and the page shows them", async () => {
    const mine = await repo.createDossier("teacher-g", "G", dossier());
    generate.mockResolvedValueOnce({ text: questions });
    const r = await outcomeRoute.action({
      request: post([
        ["intent", "guideQuestions:s1"],
        ["outcomeId", LU],
        ["text", "Nog niet bewaard."],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({ ok: true, intent: "guideQuestions" });
    const page = await load(mine.id);
    expect(page.chapter).toBe("Nog niet bewaard.");
    expect(page.guided.map((s) => [s.id, s.questions.length])).toEqual([
      ["s1", 3],
      ["s2", 0],
    ]);
  });

  it("saving the chapter also saves the answers typed beside it", async () => {
    const mine = await repo.createDossier("teacher-g", "G", asked(dossier()));
    const r = await outcomeRoute.action({
      request: post([
        ["intent", "writeChapter"],
        ["outcomeId", LU],
        ["text", "Hoofdstuk."],
        ["answer:s1", "Eerstejaars."],
        ["answer:s1", "Nog niets."],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({ ok: true, intent: "writeChapter" });
    const page = await load(mine.id);
    expect(page.chapter).toBe("Hoofdstuk.");
    expect(page.guided[0]?.answers).toEqual(["Eerstejaars.", "Nog niets."]);
  });

  it("drafts a paragraph from the answers just typed", async () => {
    const mine = await repo.createDossier("teacher-g", "G", asked(dossier({ coachMode: "draft" })));
    generate.mockResolvedValueOnce({ text: "Ik had eerstejaars." });
    const r = await outcomeRoute.action({
      request: post([
        ["intent", "guideDraft:s1"],
        ["outcomeId", LU],
        ["text", ""],
        ["answer:s1", "Eerstejaars."],
        ["answer:s1", ""],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({ ok: true, intent: "guideDraft" });
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("Eerstejaars.");
    const page = await load(mine.id);
    expect(page.chapter).toBe("## Beginsituatie\n\nIk had eerstejaars.");
    expect(page.guided[0]?.answers).toEqual(["Eerstejaars.", ""]);
  });

  it("asks all questions and then drafts the whole chapter from the answers just typed", async () => {
    const mine = await repo.createDossier("teacher-g", "G", dossier({ coachMode: "draft" }));
    generate.mockResolvedValue({ text: questions });
    const asking = await outcomeRoute.action({
      request: post([
        ["intent", "guideQuestionsAll"],
        ["outcomeId", LU],
        ["text", "Nog niet bewaard."],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(asking).toMatchObject({ ok: true, intent: "guideQuestionsAll" });
    const page = await load(mine.id);
    expect(page.chapter).toBe("Nog niet bewaard.");
    expect(page.guided.map((s) => s.questions.length)).toEqual([3, 3]);

    generate.mockReset();
    generate
      .mockResolvedValueOnce({ text: "Ik had eerstejaars." })
      .mockResolvedValueOnce({ text: "De opbouw was helder." });
    const drafting = await outcomeRoute.action({
      request: post([
        ["intent", "guideDraftAll"],
        ["outcomeId", LU],
        ["text", "Nog niet bewaard."],
        ["answer:s1", "Eerstejaars."],
        ["answer:s1", ""],
        ["answer:s1", ""],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(drafting).toEqual({ ok: true, intent: "guideDraftAll", drafted: 2, failed: 0 });
    expect(generate.mock.calls[0]![0].messages[0].content).toContain("Eerstejaars.");
    const after = await load(mine.id);
    expect(after.chapter).toBe(
      "Nog niet bewaard.\n\n## Beginsituatie\n\nIk had eerstejaars.\n\n## Opbouw van de les\n\nDe opbouw was helder.",
    );
    expect(after.guided.map((s) => s.drafted)).toEqual([true, true]);
  });

  it("returns a localized error and stores nothing when it cannot run", async () => {
    const mine = await repo.createDossier("teacher-g", "G", dossier({ coachMode: "draft" }));
    const r = await outcomeRoute.action({
      request: post([
        ["intent", "guideDraft:s1"],
        ["outcomeId", LU],
        ["text", ""],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({
      ok: false,
      error:
        "Beantwoord eerst een vraag of koppel bewijs; zonder materiaal schrijft LimeOnIt niets.",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses an unknown section", async () => {
    const mine = await repo.createDossier("teacher-g", "G", dossier());
    const r = await outcomeRoute.action({
      request: post([
        ["intent", "guideQuestions:nope"],
        ["outcomeId", LU],
        ["text", ""],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toMatchObject({ ok: false });
    expect(generate).not.toHaveBeenCalled();
  });
});

describe("the anchor's course in guided writing", () => {
  async function anchoredDossier(owner: string, patch: Partial<DossierData> = {}) {
    const courses = await import("~/server/repositories/courses.server");
    const course = await courses.createCourse(owner, {
      name: "Databases 1",
      data: {
        schedule: { groupSize: 24, sessionMinutes: 90 },
        outcomes: [],
        activities: [
          {
            id: "les-1",
            title: "Normaliseren",
            kind: "lesson",
            goal: "De student normaliseert een tabel.",
            outcomeIds: [],
          },
        ],
        assessments: [],
      },
    });
    const d = dossier({
      anchors: { [LU]: { course: { courseId: course.id, itemId: "les-1" } } },
      ...patch,
    });
    return { course, d };
  }

  it("asks with the course's facts, so the coach does not ask for them again", async () => {
    const { d } = await anchoredDossier("teacher-g");
    generate.mockResolvedValueOnce({ text: questions });
    const r = await guided.runGuidedIntent(
      user,
      d,
      "guideQuestions",
      LU,
      "s1",
      new FormData(),
      "nl",
    );
    expect(r.ok).toBe(true);
    const sent = generate.mock.calls[0]![0].messages[0].content as string;
    expect(sent).toContain("<course>");
    expect(sent).toContain("Groepsgrootte: 24");
    expect(sent).toContain("Lesdoel: De student normaliseert een tabel.");
  });

  it("drafts from the course's facts alone, without an answer or evidence", async () => {
    const { d } = await anchoredDossier("teacher-g", { coachMode: "draft", evidence: [] });
    generate.mockResolvedValueOnce({ text: "Mijn groep had 24 studenten." });
    const r = await guided.runGuidedIntent(user, d, "guideDraft", LU, "s1", new FormData(), "nl");
    expect(r.ok).toBe(true);
    expect(generate.mock.calls[0]![0].messages[0].content).toContain(
      "Duur van een lesmoment: 90 minuten",
    );
  });

  it("sends nothing of a course the teacher may not edit", async () => {
    const { d } = await anchoredDossier("someone-else");
    generate.mockResolvedValueOnce({ text: questions });
    await guided.runGuidedIntent(user, d, "guideQuestions", LU, "s1", new FormData(), "nl");
    expect(generate.mock.calls[0]![0].messages[0].content).not.toContain("<course>");
  });

  it("the Chapter tab shows the facts with the course they come from", async () => {
    const { course, d } = await anchoredDossier("teacher-g");
    const mine = await repo.createDossier("teacher-g", "G", d);
    const page = await outcomeRoute.loader({
      request: new Request("http://localhost/x?tab=chapter"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(page.courseFacts).toMatchObject({ courseId: course.id, course: "Databases 1" });
    expect(page.courseFacts?.facts).toContainEqual({ key: "groupSize", value: "24" });
    const other = await anchoredDossier("someone-else");
    const theirs = await repo.createDossier("teacher-g", "G2", other.d);
    const none = await outcomeRoute.loader({
      request: new Request("http://localhost/x?tab=chapter"),
      params: { id: theirs.id, outcomeId: LU },
    } as never);
    expect(none.courseFacts).toBeNull();
  });
});
