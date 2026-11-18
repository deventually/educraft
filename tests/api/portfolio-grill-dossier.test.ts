import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { C1, C2, LU, sampleDossier } from "../portfolio/fixtures";
import type { DossierData } from "~/lib/portfolio/types";

process.env.DATABASE_URL = "file::memory:";

const { generate, currentUser, quota } = vi.hoisted(() => ({
  generate: vi.fn(),
  currentUser: { value: { id: "teacher-d", name: "D", email: null, role: "teacher" } as never },
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

let grill: typeof import("~/server/portfolioGrillDossier.server");
let repo: typeof import("~/server/repositories/portfolio.server");
let dossierRoute: typeof import("~/routes/portfolio.$id");

beforeAll(async () => {
  grill = await import("~/server/portfolioGrillDossier.server");
  repo = await import("~/server/repositories/portfolio.server");
  dossierRoute = await import("~/routes/portfolio.$id");
});

beforeEach(() => {
  generate.mockReset();
  quota.ok = true;
});

const user = { id: "teacher-d", name: "D", email: null, role: "teacher" } as never;
const LU2 = "00000000-0000-4000-8000-000000000002";
const C3 = "00000000-0000-4000-8000-0000000000c3";

/** Confirmed, two outcomes: LU1 with an outline (s1, s2), LU2 one section per criterion (C3). */
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
        {
          id: LU2,
          code: "LU2",
          title: "Begeleiden",
          criteria: [{ id: C3, text: "Je begeleidt een student bij zijn loopbaan." }],
          requiredEvidence: [],
        },
      ],
    },
    ...patch,
  };
}

const questions = JSON.stringify({
  questions: ["Welke groep had je?", "Wat konden ze al?", "Hoe wist je dat?"],
});

/** Every section asked and answered concretely. */
function answered(d: DossierData): DossierData {
  const section = (answer: string) => ({
    questions: ["Wat deed je?"],
    answers: [answer],
    at: 1,
    model: "claude-sonnet-5-5",
  });
  return {
    ...d,
    guided: {
      [LU]: { s1: section("Tweedejaars, 24 studenten."), s2: section("Start met een vraag.") },
      [LU2]: { [C3]: section("Gesprek met Sam over stage.") },
    },
  };
}

function post(fields: [string, string][]) {
  return new Request("http://localhost/x?tab=write", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}
const load = (id: string) =>
  dossierRoute.loader({
    request: new Request("http://localhost/x?tab=write"),
    params: { id },
  } as never);
const act = (id: string, fields: [string, string][]) =>
  dossierRoute.action({ request: post(fields), params: { id } } as never);

describe("grill me over the whole dossier", () => {
  it("asks the questions for every outcome in one round, and the page lists them per outcome", async () => {
    const mine = await repo.createDossier("teacher-d", "D", dossier());
    generate.mockResolvedValue({ text: questions });
    const r = await act(mine.id, [["intent", "grillDossier"]]);
    // Three sections over two outcomes, three questions each.
    expect(r).toMatchObject({ ok: true, intent: "grillDossier", followUps: 9, failed: 0 });
    const page = await load(mine.id);
    expect(page.grill.map((o) => o.outcomeId)).toEqual([LU, LU2]);
    expect(page.grill.map((o) => o.sections.map((s) => s.questions.length))).toEqual([[3, 3], [3]]);
  });

  it("keeps the answers typed per outcome and follows up on them", async () => {
    const d = dossier();
    d.guided = {
      [LU]: { s1: { questions: ["Welke groep had je?"], answers: [], at: 1, model: "m" } },
    };
    const mine = await repo.createDossier("teacher-d", "D", d);
    generate.mockImplementation(async ({ system }: { system: string }) => ({
      text: system.includes("doorvragen")
        ? JSON.stringify({ questions: ["Hoe merkte je dat?"] })
        : questions,
    }));
    const r = await act(mine.id, [
      ["intent", "grillDossier"],
      [`answer:${LU}:s1`, "Tweedejaars, 24 studenten."],
    ]);
    expect(r).toMatchObject({ ok: true, followUps: 7 });
    const page = await load(mine.id);
    expect(page.grill[0]?.sections[0]?.answers).toEqual(["Tweedejaars, 24 studenten.", ""]);
    expect(page.grill[0]?.sections[0]?.questions).toHaveLength(2);
    // What was sent to the coach about s1 is the answer typed on this page.
    const followUp = generate.mock.calls.find(([c]) => c.system.includes("doorvragen"))?.[0];
    expect(followUp.messages[0].content).toContain("Tweedejaars, 24 studenten.");
  });

  it("works on the same questions as Grill me per outcome, in any order, without repeating one", async () => {
    const mine = await repo.createDossier("teacher-d", "D", dossier());
    const outcomeRoute = await import("~/routes/portfolio.$id.outcome.$outcomeId");
    generate.mockImplementation(async ({ system }: { system: string }) => ({
      text: system.includes("doorvragen")
        ? JSON.stringify({ questions: ["Welke groep had je?", "Hoe merkte je dat?"] })
        : questions,
    }));
    // First Grill me on LU1's chapter tab...
    await outcomeRoute.action({
      request: post([
        ["intent", "guideGrill"],
        ["outcomeId", LU],
        ["text", "Mijn les begon met een vraag."],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    generate.mockClear();
    // ...then over the whole dossier: LU1's open questions stay as they are (nothing answered,
    // so nothing to follow up on), only LU2 gets its first ones.
    const r = await act(mine.id, [["intent", "grillDossier"]]);
    expect(r).toMatchObject({ ok: true, followUps: 3 });
    expect(generate).toHaveBeenCalledTimes(1);
    // ...answer one on the dossier page and grill LU1 alone again: a question asked before is
    // never asked twice.
    await act(mine.id, [
      ["intent", "saveDossierAnswers"],
      [`answer:${LU}:s1`, "Tweedejaars."],
    ]);
    const again = await outcomeRoute.action({
      request: post([
        ["intent", "guideGrill"],
        ["outcomeId", LU],
        ["text", "Mijn les begon met een vraag."],
        ["answer:s1", "Tweedejaars."],
      ]),
      params: { id: mine.id, outcomeId: LU },
    } as never);
    expect(again).toMatchObject({ ok: true, followUps: 1 });
    const page = await load(mine.id);
    expect(page.grill[0]?.sections[0]?.questions).toEqual([
      "Welke groep had je?",
      "Wat konden ze al?",
      "Hoe wist je dat?",
      "Hoe merkte je dat?",
    ]);
    expect(page.grill[0]?.sections[0]?.answers[0]).toBe("Tweedejaars.");
  });

  it("asks at most a few parts at a time over the whole dossier", async () => {
    const d = dossier();
    d.framework.outcomes[1]!.criteria = Array.from({ length: 5 }, (_, i) => ({
      id: `00000000-0000-4000-8000-0000000000d${i}`,
      text: `Criterium ${i}`,
    }));
    let running = 0;
    let most = 0;
    generate.mockImplementation(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return { text: questions };
    });
    const r = await grill.grillDossier(user, d, "nl");
    expect(r).toMatchObject({ ok: true, followUps: 21 });
    expect(most).toBeLessThanOrEqual(4);
  });

  it("says when every answer in the dossier is concrete enough", async () => {
    generate.mockResolvedValue({ text: '{"questions": []}' });
    expect(await grill.grillDossier(user, answered(dossier()), "nl")).toMatchObject({
      ok: true,
      followUps: 0,
    });
  });

  it("needs a confirmed framework and quota, without calling the model", async () => {
    const open = dossier();
    open.framework = { ...open.framework, confirmedAt: undefined };
    expect(await grill.grillDossier(user, open, "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    quota.ok = false;
    expect(await grill.grillDossier(user, dossier(), "nl")).toEqual({
      ok: false,
      error: "quota",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("stores the answers alone, without the model", async () => {
    const mine = await repo.createDossier("teacher-d", "D", answered(dossier()));
    const r = await act(mine.id, [
      ["intent", "saveDossierAnswers"],
      [`answer:${LU2}:${C3}`, "Gesprek met Sam over zijn stage in week 12."],
    ]);
    expect(r).toMatchObject({ ok: true, intent: "saveDossierAnswers" });
    const page = await load(mine.id);
    expect(page.grill[1]?.sections[0]?.answers).toEqual([
      "Gesprek met Sam over zijn stage in week 12.",
    ]);
    expect(page.grill[0]?.sections[0]?.answers).toEqual(["Tweedejaars, 24 studenten."]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("ignores answers for an outcome or part that is not in the dossier", async () => {
    const mine = await repo.createDossier("teacher-d", "D", answered(dossier()));
    await act(mine.id, [
      ["intent", "saveDossierAnswers"],
      ["answer:nope:s1", "x"],
      [`answer:${LU}:nope`, "y"],
    ]);
    const saved = await repo.getDossier("teacher-d", mine.id);
    expect(saved?.data.guided).toEqual(answered(dossier()).guided);
  });
});

describe("draft every chapter after the grilling", () => {
  it("writes the chapters of every outcome from the answers, via the page", async () => {
    const mine = await repo.createDossier(
      "teacher-d",
      "D",
      answered(dossier({ coachMode: "draft" })),
    );
    generate.mockResolvedValue({ text: "In mijn les met tweedejaars begon ik met een vraag." });
    const r = await act(mine.id, [["intent", "draftDossier"]]);
    expect(r).toMatchObject({ ok: true, intent: "draftDossier", drafted: 3, failed: 0 });
    const saved = await repo.getDossier("teacher-d", mine.id);
    const chapter = (id: string) => saved?.data.chapters.find((c) => c.outcomeId === id);
    // The chapter typed so far stays; the sections come after it.
    expect(chapter(LU)?.text).toContain("Mijn les begon met een vraag.");
    expect(chapter(LU)?.text).toContain("## Beginsituatie");
    expect(chapter(LU)?.text).toContain("## Opbouw van de les");
    expect(chapter(LU2)?.text).toContain("In mijn les met tweedejaars");
    expect(chapter(LU2)?.aiDrafted).toBe(true);
    // One log line per section written, each with its own outcome.
    const drafts = saved?.data.aiLog.filter((e) => e.action === "draft") ?? [];
    expect(drafts.map((e) => e.outcomeId).sort()).toEqual([LU, LU, LU2].sort());
    const page = await load(mine.id);
    expect(page.grill.flatMap((o) => o.sections.map((s) => s.drafted))).toEqual([true, true, true]);
  });

  it("counts a chapter that did not work and keeps the others", async () => {
    const d = answered(dossier({ coachMode: "draft" }));
    generate.mockImplementation(async ({ messages }: { messages: { content: string }[] }) => ({
      text: messages[0]!.content.includes("Gesprek met Sam") ? "" : "Mijn les ging goed.",
    }));
    const r = await grill.draftDossier(user, d, "nl");
    expect(r).toMatchObject({ ok: true, drafted: 2, failed: 1 });
  });

  it("only drafts in draft mode, with a confirmed framework", async () => {
    expect(await grill.draftDossier(user, answered(dossier()), "nl")).toEqual({
      ok: false,
      error: "not-draft-mode",
    });
    const open = answered(dossier({ coachMode: "draft" }));
    open.framework = { ...open.framework, confirmedAt: undefined };
    expect(await grill.draftDossier(user, open, "nl")).toEqual({
      ok: false,
      error: "not-confirmed",
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("says there is nothing to write without answers", async () => {
    expect(
      await grill.draftDossier(user, dossier({ coachMode: "draft", evidence: [] }), "nl"),
    ).toEqual({ ok: false, error: "no-material" });
    expect(generate).not.toHaveBeenCalled();
  });
});
