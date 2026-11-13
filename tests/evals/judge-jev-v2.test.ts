import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EvalCase } from "../../scripts/eval-helpers";
import {
  buildJudgeJevRequest,
  EVIDENCE_FAILS,
  EVIDENCE_PASSES,
  isKnownErrorCase,
  labelsPath,
  type JudgeRow,
  judgeJevReport,
  loadJudgeSpecs,
  outputByStage,
  parseJudgeJevAnswer,
  rowKey,
} from "../../scripts/eval-judge-jev-helpers";
import { ALL_TOOLS } from "~/lib/registry";

const EVALS = join(__dirname, "../../evals");
const v1 = loadJudgeSpecs(1);
const v2 = loadJudgeSpecs();

const cases = (slug: string) =>
  (JSON.parse(readFileSync(join(EVALS, slug, "cases.json"), "utf8")) as { cases: EvalCase[] })
    .cases;
const toolOf = (slug: string) => {
  const t = ALL_TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(slug);
  return t;
};
const caseOf = (slug: string, id: string) => {
  const c = cases(slug).find((x) => x.id === id);
  if (!c) throw new Error(`${slug}/${id}`);
  return c;
};
const withKnownError = Object.keys(v2.checks)
  .filter((k) => k.endsWith("/missedKnownError"))
  .map((k) => k.split("/")[0] as string);

describe("version 2 of the checks, next to version 1", () => {
  it("keeps version 1 as it was, for rescoring its reports", () => {
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(Object.keys(v2.checks)).toEqual(Object.keys(v1.checks));
    expect(v2.holdout).toEqual(v1.holdout);
  });

  it("changes only what its fixed rules say (README, Versie 2)", () => {
    for (const [key, spec] of Object.entries(v2.checks)) {
      const old = v1.checks[key];
      if (key.endsWith("/missedKnownError")) {
        expect(spec, key).toMatchObject({ when: { knownError: true } });
        expect(JSON.stringify(spec), key).not.toContain("case.description");
        expect(JSON.stringify(spec), key).toContain("case.known_error");
      } else if (key === "cognitive-architect/inventedActivity") {
        if (!("parts" in spec)) throw new Error(key);
        for (const part of spec.parts) expect(part.ask).toContain("`output.analyst`");
      } else expect(spec, key).toEqual(old);
    }
  });
});

describe("rule 1: whether a case has a known error is decided in code", () => {
  it("reads it from the start of the case description, in English or Dutch", () => {
    expect(isKnownErrorCase({ description: "Known error: the goal is vague." })).toBe(true);
    expect(isKnownErrorCase({ description: "KNOWN ERROR in English: …" })).toBe(true);
    expect(isKnownErrorCase({ description: "Bekende fout: twee keer dezelfde vraag." })).toBe(true);
    expect(isKnownErrorCase({ description: "Ordinary case at EQF 6." })).toBe(false);
    expect(isKnownErrorCase({ description: "Ordinary case; no known error here." })).toBe(false);
    expect(isKnownErrorCase({})).toBe(false);
  });

  it("agrees with the case ids of every tool that has the check", () => {
    expect(withKnownError.length).toBeGreaterThanOrEqual(10);
    for (const slug of withKnownError)
      for (const c of cases(slug))
        expect(isKnownErrorCase(c), `${slug}/${c.id}`).toBe(/known-error/.test(c.id));
  });

  it("does not ask missedKnownError on an ordinary case, and passes it there by code", () => {
    const tool = toolOf("visit-prep");
    const ordinary = caseOf("visit-prep", "midway-internship-hbo-nl");
    const known = caseOf("visit-prep", "personal-in-criteria-known-error-nl");
    expect(buildJudgeJevRequest({ tool, c: ordinary, output: "x" }, v2).asked).not.toContain(
      "missedKnownError",
    );
    expect(buildJudgeJevRequest({ tool, c: known, output: "x" }, v2).asked).toContain(
      "missedKnownError",
    );
    const v = parseJudgeJevAnswer({ answers: {} }, tool, ordinary, v2).verdicts;
    expect(v.missedKnownError).toEqual({ verdict: "pass", by: "code" });
  });
});

describe("rule 2: the known error is its own field in the state", () => {
  const tool = toolOf("visit-prep");

  it("holds the description for a known-error case, and null for an ordinary one", () => {
    const known = caseOf("visit-prep", "personal-in-criteria-known-error-nl");
    const ordinary = caseOf("visit-prep", "midway-internship-hbo-nl");
    const k = buildJudgeJevRequest({ tool, c: known, output: "x" }, v2).request.state.case;
    const o = buildJudgeJevRequest({ tool, c: ordinary, output: "x" }, v2).request.state.case;
    expect(k.known_error).toBe(known.description);
    expect(o.known_error).toBeNull();
    expect(o.description).toBe(ordinary.description);
  });

  it("is not in a version 1 request", () => {
    const c = caseOf("visit-prep", "personal-in-criteria-known-error-nl");
    const state = buildJudgeJevRequest({ tool, c, output: "x" }, v1).request.state;
    expect(state.case).not.toHaveProperty("known_error");
  });
});

describe("rule 3: an output in stages is split by stage", () => {
  const staged = "### Stage: analyst\n\n# Doc\nA\n\n### Stage: generator\n\nB\n";

  it("turns the stage markers into fields, and leaves a single text alone", () => {
    expect(outputByStage(staged)).toEqual({ analyst: "# Doc\nA", generator: "B" });
    expect(outputByStage("Gewoon een tekst.\n### Stage: x niet aan het begin")).toBe(
      "Gewoon een tekst.\n### Stage: x niet aan het begin",
    );
  });

  it("puts the stages in the state of version 2, and the text as it is in version 1", () => {
    const tool = toolOf("cognitive-architect");
    const fresh = cases("cognitive-architect").find((c) => !c.values?.legacyActivity);
    if (!fresh) throw new Error("case");
    const r2 = buildJudgeJevRequest({ tool, c: fresh, output: staged }, v2).request;
    expect(r2.state.output).toEqual({ analyst: "# Doc\nA", generator: "B" });
    expect(r2.state.about_output).toMatch(/by stage/);
    expect(r2.questions.inventedActivity_2?.instructions).toContain("`output.analyst`");
    const r1 = buildJudgeJevRequest({ tool, c: fresh, output: staged }, v1).request;
    expect(r1.state.output).toBe(staged);
  });
});

describe("rule 4: a failure must be shown in the output itself", () => {
  const tool = toolOf("visit-prep");
  const c = caseOf("visit-prep", "midway-internship-hbo-nl");

  it("adds the same evidence sentences to every part that fails on yes", () => {
    const { request } = buildJudgeJevRequest({ tool, c, output: "x" }, v2);
    const q = request.questions.aboutAStudent_1;
    expect(q?.criteria.true.endsWith(EVIDENCE_FAILS)).toBe(true);
    expect(q?.criteria.false.endsWith(EVIDENCE_PASSES)).toBe(true);
  });

  it("leaves a part that fails on no, and every version 1 part, as written", () => {
    const known = caseOf("visit-prep", "personal-in-criteria-known-error-nl");
    const { request } = buildJudgeJevRequest({ tool, c: known, output: "x" }, v2);
    expect(request.questions.missedKnownError_1?.criteria.true).not.toContain(EVIDENCE_FAILS);
    const r1 = buildJudgeJevRequest({ tool, c, output: "x" }, v1).request;
    expect(r1.questions.aboutAStudent_1?.criteria.true).not.toContain(EVIDENCE_FAILS);
  });
});

describe("the thresholds, tried on the labelled tuning rows", () => {
  const row = (over: Partial<JudgeRow>): JudgeRow => ({
    tool: "visit-prep",
    caseId: "a",
    run: 1,
    check: "judged",
    holdout: false,
    jev: "pass",
    jevP: 0.1,
    sonnet: false,
    ...over,
  });

  it("shows false alarms and misses per threshold, only stricter than the run's", () => {
    const rows = [
      row({ caseId: "a", check: "p", jev: "fail", jevP: 0.75, sonnet: false }), // false alarm at 0.7
      row({ caseId: "b", check: "p", jev: "fail", jevP: 0.97, sonnet: false }), // false alarm up to 0.95
      row({ caseId: "c", check: "p", jev: "fail", jevP: 0.85, sonnet: true }), // agreed, unlabelled
      row({ caseId: "d", check: "p", jev: "pass", jevP: 0.25, sonnet: true }), // a miss at 0.3
      row({ caseId: "e", check: "p", jev: "pass", jevP: 0.08 }),
      row({ caseId: "f", check: "p", jev: "pass", jevP: undefined }), // passed by code
      row({ caseId: "h", holdout: true, check: "p", jev: "fail", jevP: 0.99 }), // holdout: never
    ];
    const labels = {
      [rowKey(rows[0] as JudgeRow)]: false,
      [rowKey(rows[1] as JudgeRow)]: false,
      [rowKey(rows[3] as JudgeRow)]: true,
      [rowKey(rows[6] as JudgeRow)]: false,
    };
    const md = judgeJevReport({
      date: "x",
      jevModel: "j",
      judgeModel: "s",
      rows,
      jevMs: [1],
      judgeMs: [1],
      labels,
    });
    const sweep = md.slice(md.indexOf("## Drempels"));
    // | faalt vanaf | slaagt tot | beslist | faalt | vals alarm | gemist | uitvoer zonder LLM |
    expect(sweep).toContain("| 0.70 | 0.30 | 6 | 3 | 2 | 1 | 3/6 |");
    expect(sweep).toContain("| 0.80 | 0.30 | 5 | 2 | 1 | 1 | 3/6 |");
    expect(sweep).toContain("| 0.95 | 0.30 | 4 | 1 | 1 | 1 | 3/6 |");
    expect(sweep).toContain("| 0.70 | 0.20 | 5 | 3 | 2 | 0 | 2/6 |");
    expect(sweep).toContain("| 0.70 | 0.05 | 4 | 3 | 2 | 0 | 1/6 |");
    expect(sweep).toMatch(/alleen de afstemset/);
  });

  it("names the version of the checks in the report", () => {
    const md = judgeJevReport({
      date: "x",
      jevModel: "j",
      checksVersion: 2,
      judgeModel: "s",
      rows: [],
      jevMs: [1],
      judgeMs: [1],
    });
    expect(md).toContain("Jev: j · checks: v2 · judge: s");
  });
});

describe("labels belong to one report", () => {
  it("are kept per report, so a new run with the same case ids never inherits them", () => {
    const file = labelsPath("2026-11-13a");
    expect(file.endsWith(join("evals", "judge-jev", "labels", "2026-11-13a.json"))).toBe(true);
    expect(existsSync(file)).toBe(true);
    expect(existsSync(labelsPath("2026-11-20b"))).toBe(false);
  });
});
