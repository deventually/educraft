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
