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
