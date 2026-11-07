import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C1, C2, LU, sampleDossier } from "../portfolio/fixtures";
import { addEvidence } from "~/lib/portfolio/edit";
import type { DossierData } from "~/lib/portfolio/types";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-c", name: "C", email: null, role: "teacher" } as never },
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

let coach: typeof import("~/server/portfolioCoach.server");
let repo: typeof import("~/server/repositories/portfolio.server");
let outcomeRoute: typeof import("~/routes/portfolio.$id.outcome.$outcomeId");

beforeAll(async () => {
  coach = await import("~/server/portfolioCoach.server");
  repo = await import("~/server/repositories/portfolio.server");
  outcomeRoute = await import("~/routes/portfolio.$id.outcome.$outcomeId");
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
});

const user = { id: "teacher-c", name: "C", email: null, role: "teacher" } as never;

function confirmed(d: DossierData = sampleDossier()): DossierData {
  return { ...d, framework: { ...d.framework, confirmedAt: 1 } };
}

const goodAnswer = JSON.stringify({
  criteria: [
    {
      key: "K1",
      verdict: "shown",
      quote: "Mijn les begon met een vraag.",
      strengthen: [],
      evidenceNeeded: [],
    },
    {
      key: "K2",
      verdict: "missing",
      gap: "Geen beginsituatie.",
      strengthen: ["Beschrijf de groep."],
      evidenceNeeded: [],
    },
  ],
  overall: "Helder begin.",
});

describe("reviewOutcome", () => {
  it("refuses before the framework is confirmed, and for an empty chapter", async () => {
    expect(await coach.reviewOutcome(user, sampleDossier(), LU, "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    const empty = confirmed();
    empty.chapters = [];
    expect(await coach.reviewOutcome(user, empty, LU, "nl")).toEqual({
      ok: false,
      error: "empty-chapter",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("refuses over the daily quota without calling the model", async () => {
    quota.ok = false;
    expect(await coach.reviewOutcome(user, confirmed(), LU, "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("stores the checked review and logs the AI use; never touches a status", async () => {
    generate.mockResolvedValueOnce({ text: goodAnswer });
    const r = await coach.reviewOutcome(user, confirmed(), LU, "nl", 42);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.reviews?.[LU]).toMatchObject({ at: 42, model: "claude-sonnet-5-5" });
    expect(r.review.criteria.map((c) => c.criterionId)).toEqual([C1, C2]);
    expect(r.data.aiLog.at(-1)).toEqual({
      at: 42,
      action: "review",
      outcomeId: LU,
      model: "claude-sonnet-5-5",
    });
    expect(r.data.status).toEqual(sampleDossier().status);
    const call = generate.mock.calls[0][0];
    expect(call.system).toContain("Voice & Bounds");
    expect(call.messages[0].content).toContain("<chapter>");
    expect(call.temperature).toBe(0);
  });

  it("marks a review made on a provisional framework (BDB/BKE plan, PR 3)", async () => {
    generate.mockResolvedValue({ text: goodAnswer });
    const d = confirmed();
    d.framework = { ...d.framework, national: true, provisional: true };
    const r = await coach.reviewOutcome(user, d, LU, "nl", 42);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.reviews?.[LU]?.provisional).toBe(true);
    const own = await coach.reviewOutcome(user, confirmed(), LU, "nl", 42);
    if (!own.ok) throw new Error(own.error);
    expect(own.data.reviews?.[LU]?.provisional).toBeUndefined();
  });

  it("retries once on an unusable answer, then gives up", async () => {
    generate
      .mockResolvedValueOnce({ text: "geen json" })
      .mockResolvedValueOnce({ text: goodAnswer });
    expect((await coach.reviewOutcome(user, confirmed(), LU, "nl")).ok).toBe(true);
    generate.mockReset();
    generate.mockResolvedValue({ text: "geen json" });
    expect(await coach.reviewOutcome(user, confirmed(), LU, "nl")).toEqual({
      ok: false,
      error: "failed",
    });
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("reports a provider error as failed", async () => {
    generate.mockRejectedValue(new Error("overloaded"));
    expect(await coach.reviewOutcome(user, confirmed(), LU, "nl")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("draftParagraph", () => {
  const withEvidence = () =>
    confirmed(
      addEvidence(sampleDossier(), {
        title: "Lesplan",
        kind: "lesson-plan",
        text: "Beginsituatie: tweedejaars, weinig voorkennis.",
        criterionIds: [C2],
      }),
    );

  it("only works in draft mode, the teacher's choice", async () => {
    expect(await coach.draftParagraph(user, withEvidence(), LU, C2, "", "nl")).toEqual({
      ok: false,
      error: "not-draft-mode",
    });
  });

  it("needs linked evidence for the criterion", async () => {
    const d = { ...confirmed(), coachMode: "draft" as const };
    expect(await coach.draftParagraph(user, d, LU, C2, "", "nl")).toEqual({
      ok: false,
      error: "no-evidence",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("appends the paragraph to the teacher's current text and logs it", async () => {
    generate.mockResolvedValueOnce({ text: "Mijn groep bestond uit tweedejaars." });
    const d = { ...withEvidence(), coachMode: "draft" as const };
    const r = await coach.draftParagraph(user, d, LU, C2, "Niet opgeslagen tekst.", "nl", 7);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.chapters[0]).toMatchObject({
      text: "Niet opgeslagen tekst.\n\nMijn groep bestond uit tweedejaars.",
      aiDrafted: true,
    });
    expect(r.data.aiLog.at(-1)).toMatchObject({ action: "draft", at: 7 });
    expect(generate.mock.calls[0][0].messages[0].content).toContain("Niet opgeslagen tekst.");
    expect(generate.mock.calls[0][0].system).toContain("aanvullen");
  });
});

describe("outcome route — review intent", () => {
  function post(fields: Record<string, string>) {
    return new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }

  it("stores the review, which the page then shows", async () => {
    const mine = await repo.createDossier("teacher-c", "C", confirmed());
    generate.mockResolvedValueOnce({ text: goodAnswer });
    const r = await outcomeRoute.action({
      request: post({ intent: "review", outcomeId: LU }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({ ok: true, intent: "review" });
    const page = await outcomeRoute.loader({
      request: new Request("http://localhost/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(page.stored).toMatchObject({ modelName: "Claude Sonnet 5.5" });
    expect(page.stored?.review.overall).toBe("Helder begin.");
  });

  it("returns a localized error when the coach cannot run", async () => {
    const mine = await repo.createDossier("teacher-c", "C", sampleDossier());
    const r = await outcomeRoute.action({
      request: post({ intent: "review", outcomeId: LU }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({
      ok: false,
      error: "Bevestig eerst het kader; de coach beoordeelt op jouw criteria.",
    });
  });
});

describe("proofreadOutcome", () => {
  const proposal = (quote: string, suggestion: string) =>
    JSON.stringify({
      suggestions: [{ quote, issue: "style", explanation: "Korter.", suggestion }],
    });

  it("needs a chapter, not a confirmed framework, and respects the quota", async () => {
    const empty = sampleDossier();
    empty.chapters = [];
    expect(await coach.proofreadOutcome(user, empty, LU, "nl")).toEqual({
      ok: false,
      error: "empty-chapter",
    });
    quota.ok = false;
    expect(await coach.proofreadOutcome(user, sampleDossier(), LU, "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("stores only checked proposals and logs the AI use", async () => {
    generate.mockResolvedValueOnce({
      text: JSON.stringify({
        suggestions: [
          {
            quote: "Mijn les begon met een vraag.",
            issue: "style",
            explanation: "Welke vraag?",
            suggestion: "Mijn les begon met een vraag over hun stage.",
          },
          { quote: "Niet in het hoofdstuk.", issue: "style", explanation: "x", suggestion: "y" },
        ],
      }),
    });
    const r = await coach.proofreadOutcome(user, sampleDossier(), LU, "nl", 9);
    if (!r.ok) throw new Error(r.error);
    expect(r.dropped).toBe(1);
    expect(r.data.proofreads?.[LU]).toMatchObject({ at: 9, model: "claude-sonnet-5-5" });
    expect(r.data.proofreads?.[LU].suggestions).toHaveLength(1);
    expect(r.data.aiLog.at(-1)).toEqual({
      at: 9,
      action: "proofread",
      outcomeId: LU,
      model: "claude-sonnet-5-5",
    });
    // Proposals only: the chapter itself is untouched until the teacher takes one over.
    expect(r.data.chapters).toEqual(sampleDossier().chapters);
    const call = generate.mock.calls[0][0];
    expect(call.system).toContain("Voice & Bounds");
    expect(call.system).toContain("Proeflezer");
    expect(call.messages[0].content).toContain("<chapter>\nMijn les begon met een vraag.");
  });

  it("retries once on an unusable answer, then gives up", async () => {
    generate
      .mockResolvedValueOnce({ text: "geen json" })
      .mockResolvedValueOnce({ text: proposal("Mijn les", "De les") });
    expect((await coach.proofreadOutcome(user, sampleDossier(), LU, "nl")).ok).toBe(true);
    generate.mockReset();
    generate.mockResolvedValue({ text: "geen json" });
    expect(await coach.proofreadOutcome(user, sampleDossier(), LU, "nl")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});

describe("reviewDossier", () => {
  const LU2 = "00000000-0000-4000-8000-000000000002";
  const C3 = "00000000-0000-4000-8000-0000000000c3";
  function twoOutcomes(): DossierData {
    const d = confirmed();
    return {
      ...d,
      framework: {
        ...d.framework,
        outcomes: [
          ...d.framework.outcomes,
          {
            id: LU2,
            code: "LU2",
            title: "Toetsen",
            criteria: [{ id: C3, text: "Toets." }],
            requiredEvidence: [],
          },
        ],
      },
    };
  }
  const oneCriterion = JSON.stringify({
    criteria: [{ key: "K1", verdict: "partial", strengthen: [], evidenceNeeded: [] }],
    overall: "Toetsen: begin gemaakt.",
  });

  it("refuses before the framework is confirmed, or when no chapter has text", async () => {
    expect(await coach.reviewDossier(user, sampleDossier(), "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    const empty = confirmed();
    empty.chapters = [];
    expect(await coach.reviewDossier(user, empty, "nl")).toEqual({
      ok: false,
      error: "empty-chapter",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("reviews every chapter with text, skips empty ones, and stores each review", async () => {
    generate.mockResolvedValueOnce({ text: goodAnswer });
    const r = await coach.reviewDossier(user, twoOutcomes(), "nl", 5);
    if (!r.ok) throw new Error(r.error);
    expect(r.reviewed).toEqual([LU]);
    expect(r.skipped).toEqual([LU2]);
    expect(r.failed).toEqual([]);
    expect(Object.keys(r.data.reviews ?? {})).toEqual([LU]);
    expect(r.data.aiLog.filter((e) => e.action === "review")).toHaveLength(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("marks each review as provisional on a provisional framework", async () => {
    const d = twoOutcomes();
    d.framework.provisional = true;
    generate.mockResolvedValueOnce({ text: goodAnswer });
    const r = await coach.reviewDossier(user, d, "nl", 5);
    if (!r.ok) throw new Error(r.error);
    expect(r.data.reviews?.[LU]?.provisional).toBe(true);
    const { dossierReviewOverview } = await import("~/server/portfolio.server");
    expect(dossierReviewOverview(r.data)[0].provisional).toBe(true);
  });

  it("keeps the reviews that worked when one chapter fails", async () => {
    const d = twoOutcomes();
    d.chapters = [
      ...d.chapters,
      { id: "ch2", outcomeId: LU2, text: "Ik maakte een toets.", aiDrafted: false },
    ];
    generate.mockImplementation(async ({ messages }) =>
      messages[0].content.includes("Toetsen") ? { text: oneCriterion } : { text: "kapot" },
    );
    const r = await coach.reviewDossier(user, d, "nl", 5);
    if (!r.ok) throw new Error(r.error);
    expect(r.reviewed).toEqual([LU2]);
    expect(r.failed).toEqual([LU]);
    expect(r.data.reviews?.[LU2]?.review.overall).toBe("Toetsen: begin gemaakt.");
  });
});

describe("overview route — review the whole dossier", () => {
  let overviewRoute: typeof import("~/routes/portfolio.$id");
  beforeAll(async () => {
    overviewRoute = await import("~/routes/portfolio.$id");
  });
  const post = (fields: Record<string, string>) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });

  it("reviews all chapters and the page shows an overview per outcome", async () => {
    const mine = await repo.createDossier("teacher-c", "C", confirmed());
    generate.mockResolvedValueOnce({ text: goodAnswer });
    const r = await overviewRoute.action({
      request: post({ intent: "reviewAll" }),
      params: { id: mine.id },
    } as never);
    expect(r).toEqual({ ok: true, intent: "reviewAll", reviewed: 1, failed: 0 });
    const page = await overviewRoute.loader({
      request: new Request("http://localhost/x"),
      params: { id: mine.id },
    } as never);
    expect(page.dossierReview).toEqual([
      expect.objectContaining({
        outcomeId: LU,
        shown: 1,
        partial: 0,
        missing: 1,
        overall: "Helder begin.",
        modelName: "Claude Sonnet 5.5",
      }),
    ]);
  });
});

describe("outcome route — proofread intent", () => {
  const post = (fields: Record<string, string>) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });

  it("stores the proposals; the page shows only those still in the chapter", async () => {
    const mine = await repo.createDossier("teacher-c", "C", sampleDossier());
    generate.mockResolvedValueOnce({
      text: JSON.stringify({
        suggestions: [
          {
            quote: "Mijn les begon met een vraag.",
            issue: "style",
            explanation: "Welke vraag?",
            suggestion: "Mijn les begon met een vraag over hun stage.",
          },
        ],
      }),
    });
    const r = await outcomeRoute.action({
      request: post({ intent: "proofread", outcomeId: LU }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(r).toEqual({ ok: true, intent: "proofread", proposals: 1 });
    const page = await outcomeRoute.loader({
      request: new Request("http://localhost/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(page.proofread?.suggestions).toEqual([
      expect.objectContaining({ index: 0, quote: "Mijn les begon met een vraag." }),
    ]);

    await outcomeRoute.action({
      request: post({ intent: "writeChapter", outcomeId: LU, text: "Helemaal nieuw." }),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    const after = await outcomeRoute.loader({
      request: new Request("http://localhost/x"),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(after.proofread?.suggestions).toEqual([]);
  });
});
