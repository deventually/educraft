import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EVIDENCE_KINDS } from "~/lib/portfolio/types";
import {
  caseDossier,
  type EvidenceEvalFile,
  HOLDOUT_FILE,
  loadSuite,
  scoreSort,
} from "../../scripts/eval-evidence-helpers";
import {
  askJev,
  buildJevRequest,
  JEV_MODEL,
  JEV_THRESHOLDS,
  loadCriterionParts,
  parseJevAnswer,
} from "../../scripts/eval-evidence-jev-helpers";

const dir = join(__dirname, "../../evals/portfolio-evidence");
const suite = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as EvidenceEvalFile;
const parts = loadCriterionParts();
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

const SLUG_LU1 = "lu1_doceren";
const SLUG_LU2 = "lu2_begeleiden";

/** Jev's answer for nl-lesson-plan as the case expects it: LU1, a lesson plan, its criteria, R1. */
function goodLessonPlanAnswer(): { answers: Record<string, unknown>; usage: { cost: number } } {
  const c = caseOf("nl-lesson-plan");
  const req = buildJevRequest(caseDossier(suite, c), c.file, c.locale, { parts });
  const answers: Record<string, unknown> = {};
  for (const key of Object.keys(req.questions)) answers[key] = noul(0.05);
  answers.evidence = noul(0.95);
  answers.outcome = choice(SLUG_LU1, 0.93);
  answers.kind = choice("lesson-plan", 0.9);
  const good = c.good as { criteria: string[]; required: string };
  for (const id of good.criteria) {
    const j = id.split(".C")[1];
    for (const key of Object.keys(req.questions))
      if (key.startsWith(`c_${SLUG_LU1}_${j}_`)) answers[key] = noul(0.88);
  }
  answers[`r_${SLUG_LU1}_${good.required.split(".R")[1]}`] = noul(0.8);
  return { answers, usage: { cost: 0.00004 } };
}

describe("Jev on the evidence sort: the request (TypeSafe's skill, in full)", () => {
  const c = caseOf("nl-lesson-plan");
  const d = caseDossier(suite, c);
  const req = buildJevRequest(d, c.file, c.locale, { parts });

  it("names outcome options by what they are, described as objects with their criteria", () => {
    expect(req.model).toBe(JEV_MODEL);
    expect(req.questions.outcome?.type).toBe("choice");
    expect(Object.keys(req.questions.outcome?.criteria ?? {})).toEqual([
      "lu1_doceren",
      "lu2_begeleiden",
      "lu3_ontwerpen",
      "lu4_toetsen",
      "lu5_professionele_ontwikkeling",
    ]);
    expect(req.questions.outcome?.criteria?.lu1_doceren).toEqual({
      leeruitkomst: "LU1 Doceren",
      criteria: d.framework.outcomes[0]?.criteria.map((x) => x.text),
    });
    const en = caseOf("en-lesson-plan");
    const enReq = buildJevRequest(caseDossier(suite, en), en.file, en.locale);
    expect(enReq.questions.outcome?.criteria?.lo1_teaching).toMatchObject({
      learning_outcome: "LO1 Teaching",
    });
  });

  it("asks the null case as its own yes/no, not as a 'none' option", () => {
    expect(req.questions.evidence?.type).toBe("noul");
    expect(Object.keys(req.questions.evidence?.criteria ?? {})).toEqual(["true", "false"]);
    expect(req.questions.evidence?.criteria?.false).toMatch(/sjabloon/i);
    expect(Object.keys(req.questions.outcome?.criteria ?? {})).not.toContain("none");
  });

  it("asks the kind over exactly the app's kinds, each saying what it covers and excludes", () => {
    expect(req.questions.kind?.type).toBe("choice");
    expect(Object.keys(req.questions.kind?.criteria ?? {})).toEqual([...EVIDENCE_KINDS]);
    expect(req.questions.kind?.criteria?.feedback).toMatchObject({
      omvat: expect.any(String),
      niet: expect.stringMatching(/reflectie/),
    });
  });

  it("rotates the option order per repeat, against Jev's lean toward the first option", () => {
    const r1 = buildJevRequest(d, c.file, c.locale, { parts, rotate: 1 });
    expect(Object.keys(r1.questions.outcome?.criteria ?? {})[0]).toBe("lu2_begeleiden");
    expect(Object.keys(r1.questions.kind?.criteria ?? {})[0]).toBe(EVIDENCE_KINDS[1]);
    expect(new Set(Object.keys(r1.questions.outcome?.criteria ?? {}))).toEqual(
      new Set(Object.keys(req.questions.outcome?.criteria ?? {})),
    );
  });

  it("asks one judgment per question: a compound criterion is asked per part", () => {
    const o = d.framework.outcomes[0];
    expect(req.questions[`c_${SLUG_LU1}_1_1`]?.instructions).toContain("heldere opbouw");
    expect(req.questions[`c_${SLUG_LU1}_1_2`]?.instructions).toContain("passende leerdoelen");
    expect(req.questions[`c_${SLUG_LU1}_2_1`]?.instructions).toContain(o?.criteria[1]?.text);
    expect(req.questions[`c_${SLUG_LU1}_2_2`]).toBeUndefined();
    expect(req.questions[`r_${SLUG_LU1}_1`]?.instructions).toContain(o?.requiredEvidence[0]);
    // Without parts every criterion is one question.
    const whole = buildJevRequest(d, c.file, c.locale);
    expect(whole.questions[`c_${SLUG_LU1}_1_1`]?.instructions).toContain(o?.criteria[0]?.text);
    expect(whole.questions[`c_${SLUG_LU1}_1_2`]).toBeUndefined();
  });

  it("names the state by its path in the questions", () => {
    for (const key of ["evidence", "outcome", "kind", `c_${SLUG_LU1}_1_1`, `r_${SLUG_LU1}_1`])
      expect(req.questions[key]?.instructions, key).toMatch(/`file(\.\w+)?`/);
  });

  it("puts the file as named fields in the state, and says so when no text was read", () => {
    expect(req.state.file.folder).toBe("Mijn bewijs/LU1");
    expect(req.state.file.name).toBe("lesvoorbereiding-medicijnrekenen.docx");
    expect(req.state.file.text).toContain(c.file.text.slice(0, 40));
    expect(req.state.dossier).toMatch(/dossier/i);
    expect(buildJevRequest(d, { name: "los.docx", text: "x" }, "nl").state.file.folder).toBe("");
    expect(buildJevRequest(d, { name: "scan.pdf", text: "  " }, "nl").state.about_text).toMatch(
      /geen tekst/i,
    );
    expect(buildJevRequest(d, { name: "scan.pdf", text: "" }, "en").state.about_text).toMatch(
      /no text/i,
    );
  });
});

describe("the criterion parts", () => {
  it("split only criteria the frameworks really have, each into two or more parts", () => {
    const all = new Set(
      Object.values(suite.frameworks).flatMap((f) => f.flatMap((o) => o.criteria)),
    );
    for (const [criterion, list] of Object.entries(parts)) {
      expect(all.has(criterion), criterion).toBe(true);
      expect(list.length, criterion).toBeGreaterThanOrEqual(2);
    }
  });

  it.skipIf(!existsSync(HOLDOUT_FILE))(
    "are the same for the holdout, which uses the main frameworks",
    () => {
      expect(loadSuite("holdout").frameworks).toEqual(suite.frameworks);
    },
  );
});

describe("Jev on the evidence sort: the truth table", () => {
  const c = caseOf("nl-lesson-plan");
  const d = caseDossier(suite, c);
  const file = { key: c.id, ...c.file };

  it("a clear answer passes every check of the existing scorer", () => {
    const { proposal, usable, why } = parseJevAnswer(goodLessonPlanAnswer(), d, file);
    expect(usable).toBe(true);
    expect(why).toEqual([]);
    expect(proposal.check).toBe(false);
    expect(scoreSort(suite, c, usable, proposal).pass).toBe(true);
  });

  it("proposes a criterion when one of its parts is a yes", () => {
    const raw = goodLessonPlanAnswer();
    raw.answers[`c_${SLUG_LU1}_1_1`] = noul(0.05);
    raw.answers[`c_${SLUG_LU1}_1_2`] = noul(0.9);
    expect(parseJevAnswer(raw, d, file).proposal.criterionIds).toContain("eval-u1-c1");
    raw.answers[`c_${SLUG_LU1}_1_2`] = noul(0.05);
    expect(parseJevAnswer(raw, d, file).proposal.criterionIds).not.toContain("eval-u1-c1");
  });

  it("keeps only criteria and lines of the chosen outcome", () => {
    const raw = goodLessonPlanAnswer();
    raw.answers[`c_${SLUG_LU2}_1_1`] = noul(0.99);
    raw.answers[`r_${SLUG_LU2}_1`] = noul(0.99);
    const { proposal } = parseJevAnswer(raw, d, file);
    expect(proposal.criterionIds.every((id) => id.startsWith("eval-u1-"))).toBe(true);
    expect(proposal.line).toBe(d.framework.outcomes[0]?.requiredEvidence[0]);
  });

  it("gives the unsettled band of a criterion its own row: not proposed, no check", () => {
    expect(JEV_THRESHOLDS).toMatchObject({ yes: 0.7, no: 0.3, outcomeSure: 0.7, kindSure: 0.7 });
    const raw = goodLessonPlanAnswer();
    raw.answers[`c_${SLUG_LU1}_2_1`] = noul(0.5);
    const r = parseJevAnswer(raw, d, file);
    expect(r.proposal.criterionIds).not.toContain("eval-u1-c2");
    expect(r.proposal.check).toBe(false);
    const strict = parseJevAnswer(raw, d, file, { ...JEV_THRESHOLDS, unsettled: true });
    expect(strict.why).toEqual([`unsettled:c_${SLUG_LU1}_2`]);
  });

  it("marks 'Controleren' when the outcome or the kind is below its threshold", () => {
    const unsure = goodLessonPlanAnswer();
    unsure.answers.outcome = choice(SLUG_LU1, JEV_THRESHOLDS.outcomeSure - 0.01);
    expect(parseJevAnswer(unsure, d, file).why).toEqual(["outcome"]);
    const kind = goodLessonPlanAnswer();
    kind.answers.kind = choice("lesson-plan", JEV_THRESHOLDS.kindSure - 0.01);
    expect(parseJevAnswer(kind, d, file).why).toEqual(["kind"]);
  });

  it("not evidence: no outcome, no criteria and a check", () => {
    const raw = goodLessonPlanAnswer();
    raw.answers.evidence = noul(JEV_THRESHOLDS.no);
    const r = parseJevAnswer(raw, d, file);
    expect(r.proposal.outcomeId).toBeUndefined();
    expect(r.proposal.criterionIds).toEqual([]);
    expect(r.why).toEqual(["not-evidence"]);
  });

  it("unsure whether it is evidence: the outcome stays, with a check", () => {
    const raw = goodLessonPlanAnswer();
    raw.answers.evidence = noul(0.5);
    const r = parseJevAnswer(raw, d, file);
    expect(r.proposal.outcomeId).toBe("eval-u1");
    expect(r.why).toEqual(["evidence"]);
  });

  it("no criterion proposed, or no text: a check, and the title is the file's own name", () => {
    const raw = goodLessonPlanAnswer();
    for (const k of Object.keys(raw.answers)) if (k.startsWith("c_")) raw.answers[k] = noul(0.05);
    expect(parseJevAnswer(raw, d, file).why).toEqual(["no-criteria"]);
    const empty = parseJevAnswer(goodLessonPlanAnswer(), d, { ...file, text: "" });
    expect(empty.why).toEqual(["no-text"]);
    expect(empty.proposal.title).toBe("lesvoorbereiding-medicijnrekenen");
  });

  it("an unknown option, a refusal or a broken body is a check, never a crash", () => {
    const unknown = goodLessonPlanAnswer();
    unknown.answers.kind = choice("essay", 0.99);
    expect(parseJevAnswer(unknown, d, file).proposal).toMatchObject({ kind: "other", check: true });
    const refused = goodLessonPlanAnswer();
    refused.answers.outcome = { type: "refusal" };
    expect(parseJevAnswer(refused, d, file).why).toEqual(["none"]);
    for (const broken of [null, "nonsense", { answers: 3 }]) {
      const r = parseJevAnswer(broken, d, file);
      expect(r.usable).toBe(false);
      expect(r.why).toEqual(["unusable"]);
      expect(r.proposal).toMatchObject({ kind: "other", criterionIds: [], check: true });
    }
  });

  it("reports the outcome probability and the cost Jev returned", () => {
    const r = parseJevAnswer(goodLessonPlanAnswer(), d, file);
    expect(r.outcomeProbability).toBeCloseTo(0.93);
    expect(r.costUsd).toBeCloseTo(0.00004);
  });
});

describe("askJev", () => {
  const c = caseOf("nl-lesson-plan");
  const req = buildJevRequest(caseDossier(suite, c), c.file, c.locale, { parts });

  it("posts the request to OpenRouter's decisions endpoint with the key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ answers: {} }), { status: 200 });
    }) as typeof fetch;
    const r = await askJev(req, { apiKey: "k", fetch: fetchFn });
    expect(calls[0]?.url).toBe("https://openrouter.ai/api/alpha/decisions");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer k");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(req);
    expect(r.body).toEqual({ answers: {} });
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });

  it("throws with the status on an error, so a run stops instead of scoring nothing", async () => {
    const fetchFn = (async () => new Response("no", { status: 402 })) as unknown as typeof fetch;
    await expect(askJev(req, { apiKey: "k", fetch: fetchFn })).rejects.toThrow(/402/);
  });
});
