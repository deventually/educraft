import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_KINDS } from "~/lib/portfolio/types";
import { caseDossier, type EvidenceEvalFile, scoreSort } from "../../scripts/eval-evidence-helpers";
import {
  askJev,
  buildJevRequest,
  JEV_MODEL,
  JEV_THRESHOLDS,
  parseJevAnswer,
} from "../../scripts/eval-evidence-jev-helpers";

const dir = join(__dirname, "../../evals/portfolio-evidence");
const suite = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as EvidenceEvalFile;
const caseOf = (id: string) => {
  const c = suite.cases.find((x) => x.id === id);
  if (!c) throw new Error(id);
  return c;
};

const noul = (p: number) => ({ type: "noul", noul: p });
const choice = (pick: string, p: number) => ({
  type: "choice",
  choice: pick,
  confidence: p,
  probabilities: { [pick]: p },
});

/** Jev's answer for nl-lesson-plan as the case expects it: LU1, a lesson plan, C1 and C3, R1. */
function goodLessonPlanAnswer(): Record<string, unknown> {
  const c = caseOf("nl-lesson-plan");
  const req = buildJevRequest(caseDossier(suite, c), c.file, c.locale);
  const answers: Record<string, unknown> = {};
  for (const key of Object.keys(req.questions)) answers[key] = noul(0.05);
  answers.outcome = choice("U1", 0.93);
  answers.kind = choice("lesson-plan", 0.9);
  const good = c.good as { criteria: string[]; required: string };
  for (const k of good.criteria) answers[`c_${k.replace(".C", "_")}`] = noul(0.88);
  answers[`r_${good.required.replace(".R", "_")}`] = noul(0.8);
  return { model: "typesafe/jev-1.14.0", answers, usage: { input_tokens: 900, cost: 0.00004 } };
}

describe("Jev on the evidence sort: the request", () => {
  const c = caseOf("nl-lesson-plan");
  const d = caseDossier(suite, c);
  const req = buildJevRequest(d, c.file, c.locale);

  it("asks one choice for the outcome, with every outcome and 'none' as options", () => {
    expect(req.model).toBe(JEV_MODEL);
    expect(req.questions.outcome?.type).toBe("choice");
    const options = Object.keys(req.questions.outcome?.criteria ?? {});
    expect(options).toEqual([...d.framework.outcomes.map((_, i) => `U${i + 1}`), "none"]);
    expect(req.questions.outcome?.criteria?.U1).toContain(d.framework.outcomes[0]?.title);
  });

  it("asks one choice for the kind, over exactly the app's evidence kinds", () => {
    expect(req.questions.kind?.type).toBe("choice");
    expect(Object.keys(req.questions.kind?.criteria ?? {})).toEqual([...EVIDENCE_KINDS]);
    expect(req.questions.kind?.criteria?.feedback).toMatch(/nooit|never/i);
  });

  it("asks a yes/no per criterion and per required line, with the form's own words", () => {
    const o = d.framework.outcomes[0];
    expect(req.questions.c_U1_1?.type).toBe("noul");
    expect(req.questions.c_U1_1?.instructions).toContain(o?.criteria[0]?.text);
    expect(req.questions.r_U1_1?.instructions).toContain(o?.requiredEvidence[0]);
    const criteria = d.framework.outcomes.reduce((n, x) => n + x.criteria.length, 0);
    const lines = d.framework.outcomes.reduce((n, x) => n + x.requiredEvidence.length, 0);
    expect(Object.keys(req.questions)).toHaveLength(2 + criteria + lines);
  });

  it("puts the file as data in the state, and says so when no text was read", () => {
    expect(req.state.file).toBe(c.file.name);
    expect(req.state.text).toContain(c.file.text.slice(0, 40));
    const empty = buildJevRequest(d, { name: "scan.pdf", text: "  " }, "nl");
    expect(empty.state.text).toMatch(/geen tekst/i);
    expect(buildJevRequest(d, { name: "scan.pdf", text: "" }, "en").state.text).toMatch(/no text/i);
  });

  it("asks in the case's language", () => {
    const en = caseOf("en-lesson-plan");
    const enReq = buildJevRequest(caseDossier(suite, en), en.file, en.locale);
    expect(enReq.questions.outcome?.instructions).toMatch(/learning outcome/i);
    expect(req.questions.outcome?.instructions).toMatch(/leeruitkomst/i);
  });
});

describe("Jev on the evidence sort: the answer becomes the app's proposal", () => {
  const c = caseOf("nl-lesson-plan");
  const d = caseDossier(suite, c);
  const file = { key: c.id, ...c.file };

  it("a clear answer passes every check of the existing scorer", () => {
    const { proposal, usable } = parseJevAnswer(goodLessonPlanAnswer(), d, file);
    expect(usable).toBe(true);
    expect(proposal.check).toBe(false);
    expect(scoreSort(suite, c, usable, proposal).pass).toBe(true);
  });

  it("keeps only criteria and lines of the chosen outcome, above the threshold", () => {
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.c_U2_1 = noul(0.99);
    raw.answers.c_U1_2 = noul(JEV_THRESHOLDS.no);
    const { proposal } = parseJevAnswer(raw, d, file);
    expect(proposal.criterionIds.every((id) => id.startsWith("eval-u1-"))).toBe(true);
    expect(proposal.criterionIds).not.toContain("eval-u1-c2");
    expect(proposal.check).toBe(false);
  });

  it("by default an unsettled yes/no is simply not a yes: BDB criteria are compound, so Jev often lands mid-way (meting jev3)", () => {
    expect(JEV_THRESHOLDS.unsettled).toBe(false);
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.c_U1_2 = noul((JEV_THRESHOLDS.no + JEV_THRESHOLDS.yes) / 2);
    const { proposal } = parseJevAnswer(raw, d, file);
    expect(proposal.criterionIds).not.toContain("eval-u1-c2");
    expect(proposal.check).toBe(false);
  });

  it("with `unsettled` on, an unsettled yes/no on the chosen outcome is a check", () => {
    const strict = { ...JEV_THRESHOLDS, unsettled: true };
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.c_U1_2 = noul((JEV_THRESHOLDS.no + JEV_THRESHOLDS.yes) / 2);
    expect(parseJevAnswer(raw, d, file, strict).proposal.check).toBe(true);
    const other = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    other.answers.c_U2_1 = noul(0.5); // another outcome's doubt does not matter
    expect(parseJevAnswer(other, d, file, strict).proposal.check).toBe(false);
  });

  it("marks 'Controleren' when Jev is unsure of the outcome or the kind", () => {
    const unsure = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    unsure.answers.outcome = choice("U1", JEV_THRESHOLDS.outcomeSure - 0.01);
    expect(parseJevAnswer(unsure, d, file).proposal.check).toBe(true);
    const kind = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    kind.answers.kind = choice("lesson-plan", JEV_THRESHOLDS.kindSure - 0.01);
    expect(parseJevAnswer(kind, d, file).proposal.check).toBe(true);
  });

  it("takes other thresholds, to tune them offline on saved answers", () => {
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.outcome = choice("U1", 0.75);
    raw.answers.c_U1_2 = noul(0.5);
    expect(
      parseJevAnswer(raw, d, file, { ...JEV_THRESHOLDS, unsettled: true }).proposal.check,
    ).toBe(true);
    const lenient = { ...JEV_THRESHOLDS, outcomeSure: 0.7, unsettled: false };
    expect(parseJevAnswer(raw, d, file, lenient).proposal.check).toBe(false);
    expect(parseJevAnswer(raw, d, file, lenient).why).toEqual([]);
  });

  it("says why it set 'Controleren', so the thresholds can be tuned", () => {
    expect(parseJevAnswer(goodLessonPlanAnswer(), d, file).why).toEqual([]);
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.outcome = choice("U1", JEV_THRESHOLDS.outcomeSure - 0.01);
    raw.answers.c_U1_2 = noul(0.5);
    expect(parseJevAnswer(raw, d, file).why).toEqual(["outcome"]);
    expect(parseJevAnswer(raw, d, file, { ...JEV_THRESHOLDS, unsettled: true }).why).toEqual([
      "outcome",
      "unsettled:c_U1_2",
    ]);
    expect(parseJevAnswer(goodLessonPlanAnswer(), d, { ...file, text: "" }).why).toEqual([
      "no-text",
    ]);
    expect(parseJevAnswer(null, d, file).why).toEqual(["unusable"]);
  });

  it("'none' is no outcome, no criteria and a check", () => {
    const raw = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    raw.answers.outcome = choice("none", 0.95);
    const { proposal } = parseJevAnswer(raw, d, file);
    expect(proposal.outcomeId).toBeUndefined();
    expect(proposal.criterionIds).toEqual([]);
    expect(proposal.check).toBe(true);
  });

  it("an unknown option, a refusal or a broken body is a check, never a crash", () => {
    const unknown = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    unknown.answers.kind = choice("essay", 0.99);
    expect(parseJevAnswer(unknown, d, file).proposal).toMatchObject({ kind: "other", check: true });
    const refused = goodLessonPlanAnswer() as { answers: Record<string, unknown> };
    refused.answers.outcome = { type: "refusal" };
    expect(parseJevAnswer(refused, d, file).proposal.check).toBe(true);
    for (const broken of [null, "nonsense", { answers: 3 }]) {
      const r = parseJevAnswer(broken, d, file);
      expect(r.usable).toBe(false);
      expect(r.proposal).toMatchObject({ kind: "other", criterionIds: [], check: true });
    }
  });

  it("a file without text is always a check, and the title is the file's own name", () => {
    const { proposal } = parseJevAnswer(goodLessonPlanAnswer(), d, { ...file, text: "" });
    expect(proposal.check).toBe(true);
    expect(proposal.title).toBe("lesvoorbereiding-medicijnrekenen");
  });

  it("reports the outcome probability and the cost Jev returned", () => {
    const r = parseJevAnswer(goodLessonPlanAnswer(), d, file);
    expect(r.outcomeProbability).toBeCloseTo(0.93);
    expect(r.costUsd).toBeCloseTo(0.00004);
  });
});

describe("askJev", () => {
  const c = caseOf("nl-lesson-plan");
  const req = buildJevRequest(caseDossier(suite, c), c.file, c.locale);

  it("posts the request to OpenRouter's decisions endpoint with the key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ answers: {} }), { status: 200 });
    }) as typeof fetch;
    const r = await askJev(req, { apiKey: "k", fetch: fetchFn });
    expect(calls[0]?.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer k");
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ model: JEV_MODEL });
    expect(r.body).toEqual({ answers: {} });
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("throws with the status on an error, so a run stops instead of scoring nothing", async () => {
    const fetchFn = (async () => new Response("no", { status: 402 })) as unknown as typeof fetch;
    await expect(askJev(req, { apiKey: "k", fetch: fetchFn })).rejects.toThrow(/402/);
  });
});
