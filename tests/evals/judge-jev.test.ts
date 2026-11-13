import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { ALL_TOOLS } from "~/lib/registry";
import { type EvalCase, parseHardChecks } from "../../scripts/eval-helpers";
import {
  buildJudgeJevRequest,
  catalogPrice,
  judgeJevReport,
  JUDGE_JEV_THRESHOLDS,
  listPriceUsd,
  type JudgeRow,
  loadJudgeSpecs,
  parseJudgeJevAnswer,
  rowKey,
  scoreLabels,
} from "../../scripts/eval-judge-jev-helpers";

const EVALS = join(__dirname, "../../evals");
const specs = loadJudgeSpecs();

/** The tools `npm run eval` judges that have judged hard checks, with those checks. */
const judged = ALL_TOOLS.flatMap((t) => {
  let rubric = "";
  try {
    rubric = readFileSync(join(EVALS, t.slug, "rubric.md"), "utf8");
  } catch {
    return [];
  }
  const checks = parseHardChecks(rubric).filter((c) => !c.counted);
  return checks.length ? [{ tool: t, checks }] : [];
});

const cases = (slug: string) =>
  (JSON.parse(readFileSync(join(EVALS, slug, "cases.json"), "utf8")) as { cases: EvalCase[] })
    .cases;
const toolOf = (slug: string) => {
  const t = ALL_TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(slug);
  return t;
};
const noul = (p: number) => ({ type: "noul", noul: p });

describe("the judge's hard checks as Jev questions", () => {
  it("cover every judged hard check of the eval tools, and nothing else", () => {
    const want = judged.flatMap(({ tool, checks }) => checks.map((c) => `${tool.slug}/${c.id}`));
    expect(Object.keys(specs.checks).sort()).toEqual(want.sort());
    expect(want.length).toBeGreaterThanOrEqual(100);
  });

  it("give each check either parts for Jev or a reason it stays with the LLM judge", () => {
    for (const [key, spec] of Object.entries(specs.checks)) {
      if ("llm" in spec) {
        expect(spec.llm.length, key).toBeGreaterThan(20);
        continue;
      }
      expect(spec.parts.length, key).toBeGreaterThan(0);
      for (const part of spec.parts) {
        expect(part.ask, key).toMatch(/`(output|case\.\w+)`/); // the state by its path
        expect(part.ask.trim().endsWith("?"), key).toBe(true);
        expect(part.yes && part.no, key).toBeTruthy();
        expect(["yes", "no"], key).toContain(part.fails);
      }
    }
  });

  it("keep math, counting and exact lookups with the LLM judge (TypeSafe's jaggedness page)", () => {
    for (const key of [
      "lesson-plan/timeDoesNotAddUp",
      "rubric-builder/wrongArithmetic",
      "test-items/blueprintMismatch",
      "group-feedback/inventedNumber",
    ])
      expect(specs.checks[key], key).toHaveProperty("llm");
  });

  it("hold out every third tool alphabetically, from the third, by a fixed rule", () => {
    const tools = judged.map((j) => j.tool.slug).sort();
    expect(specs.holdout).toEqual(tools.filter((_, i) => i % 3 === 2));
  });
});

describe("the request for one output", () => {
  const tool = toolOf("cognitive-architect");
  const [redesign, fresh] = cases("cognitive-architect");
  if (!redesign || !fresh) throw new Error("cases");

  it("puts tool, case and output in the state as named fields", () => {
    const { request } = buildJudgeJevRequest({ tool, c: fresh, output: "Het ontwerp…" }, specs);
    expect(request.model).toBe("typesafe/jev-1.14");
    expect(request.state.output).toBe("Het ontwerp…");
    expect(request.state.case.description).toBe(fresh.description);
    expect(request.state.case.inputs).toEqual(fresh.values);
    expect(request.state.tool.name).toBe(loc(tool.name, "en"));
    expect(request.state.about_output).toMatch(/greeting/);
  });

  it("asks a check only when its condition on the case holds, decided in code", () => {
    const asked = buildJudgeJevRequest({ tool, c: fresh, output: "x" }, specs).asked;
    expect(asked).toEqual(["inventedActivity"]);
    expect(buildJudgeJevRequest({ tool, c: redesign, output: "x" }, specs).asked).toEqual([]);
  });

  it("asks every part as its own yes/no", () => {
    const { request } = buildJudgeJevRequest({ tool, c: fresh, output: "x" }, specs);
    expect(Object.keys(request.questions)).toEqual(["inventedActivity_1", "inventedActivity_2"]);
    const q = request.questions.inventedActivity_1;
    expect(q?.type).toBe("noul");
    expect(Object.keys(q?.criteria ?? {})).toEqual(["true", "false"]);
  });

  it("never asks a check that stays with the LLM judge", () => {
    const lp = toolOf("lesson-plan");
    const [c] = cases("lesson-plan");
    if (!c) throw new Error("case");
    const { request, asked } = buildJudgeJevRequest({ tool: lp, c, output: "x" }, specs);
    expect(asked).not.toContain("timeDoesNotAddUp");
    expect(Object.keys(request.questions).some((k) => k.startsWith("timeDoesNotAddUp"))).toBe(
      false,
    );
  });

  it("decides an mbo-only check from the case's level", () => {
    const tool2 = toolOf("conversation-prep");
    const all = cases("conversation-prep");
    const mbo = all.find((c) => c.profile?.eqf === 4);
    const hbo = all.find((c) => c.profile?.eqf === 6);
    if (!mbo || !hbo) throw new Error("cases");
    expect(buildJudgeJevRequest({ tool: tool2, c: mbo, output: "x" }, specs).asked).toContain(
      "wrongSectorWords",
    );
    expect(buildJudgeJevRequest({ tool: tool2, c: hbo, output: "x" }, specs).asked).not.toContain(
      "wrongSectorWords",
    );
  });
});

describe("the truth table per check", () => {
  const tool = toolOf("visit-prep");
  const [c] = cases("visit-prep");
  if (!c) throw new Error("case");
  const verdict = (answers: Record<string, unknown>) =>
    parseJudgeJevAnswer({ answers }, tool, c, specs).verdicts;

  it("fails a check when one part shows the failure, passes it when every part is clear", () => {
    const v = verdict({
      missedKnownError_1: noul(0.9), // asked positively: yes means handled
      aboutAStudent_1: noul(0.1),
      aboutAStudent_2: noul(0.85),
      judged_1: noul(0.05),
      judged_2: noul(0.1),
      inventedCriteria_1: noul(0.2),
    });
    expect(v.missedKnownError?.verdict).toBe("pass");
    expect(v.aboutAStudent?.verdict).toBe("fail");
    expect(v.judged?.verdict).toBe("pass");
    expect(v.inventedCriteria?.verdict).toBe("pass");
  });

  it("reads a positively asked part the other way round", () => {
    expect(verdict({ missedKnownError_1: noul(0.1) }).missedKnownError?.verdict).toBe("fail");
  });

  it("leaves the band between 0.3 and 0.7 unsettled: its own row, for the LLM judge", () => {
    expect(JUDGE_JEV_THRESHOLDS).toEqual({ yes: 0.7, no: 0.3 });
    const v = verdict({ judged_1: noul(0.5), judged_2: noul(0.1) });
    expect(v.judged?.verdict).toBe("unsettled");
    expect(v.inventedCriteria?.verdict).toBe("unsettled"); // no answer at all
  });

  it("lets a clear failure win over an unsettled part", () => {
    expect(verdict({ judged_1: noul(0.5), judged_2: noul(0.95) }).judged?.verdict).toBe("fail");
  });

  it("passes a check whose condition does not hold, and marks LLM-only checks", () => {
    const ca = toolOf("cognitive-architect");
    const [redesign] = cases("cognitive-architect");
    if (!redesign) throw new Error("case");
    const v = parseJudgeJevAnswer({ answers: {} }, ca, redesign, specs).verdicts;
    expect(v.inventedActivity).toEqual({ verdict: "pass", by: "code" });
    const lp = toolOf("lesson-plan");
    const [lc] = cases("lesson-plan");
    if (!lc) throw new Error("case");
    expect(parseJudgeJevAnswer({ answers: {} }, lp, lc, specs).verdicts.wrongContent).toEqual({
      verdict: "llm",
    });
  });

  it("reports the highest failure probability, and Jev's cost; a broken body is unusable", () => {
    const r = parseJudgeJevAnswer(
      {
        answers: { aboutAStudent_1: noul(0.2), aboutAStudent_2: noul(0.4) },
        usage: { cost: 1e-4 },
      },
      tool,
      c,
      specs,
    );
    expect(r.verdicts.aboutAStudent?.p).toBeCloseTo(0.4);
    expect(r.costUsd).toBeCloseTo(1e-4);
    expect(parseJudgeJevAnswer("nonsense", tool, c, specs).usable).toBe(false);
  });
});

describe("the comparison with the LLM judge", () => {
  const row = (over: Partial<JudgeRow>): JudgeRow => ({
    tool: "visit-prep",
    caseId: "a",
    run: 1,
    check: "judged",
    holdout: false,
    jev: "pass",
    sonnet: false,
    ...over,
  });

  it("counts agreement on settled checks, unsettled ones, and those left to the LLM", () => {
    const rows = [
      row({}),
      row({ check: "aboutAStudent", jev: "fail", sonnet: true }),
      row({ check: "invented", jev: "fail", sonnet: false }),
      row({ check: "x", jev: "unsettled" }),
      row({ check: "y", jev: "llm", sonnet: true }),
      row({ check: "z", holdout: true, jev: "pass", sonnet: true }),
    ];
    const md = judgeJevReport({
      date: "2026-11-13",
      jevModel: "typesafe/jev-1.14",
      judgeModel: "claude-sonnet-5-5",
      rows,
      jevMs: [200, 400],
      judgeMs: [5000, 7000],
      jevCostUsd: 0.0002,
      judgeCostUsd: 0.05,
    });
    expect(md).toContain("| Afstemmen | 3 | 2/3 | 1 | 1 |");
    expect(md).toContain("| Holdout | 1 | 0/1 | 0 | 0 |");
    expect(md).toMatch(/Jev: gemiddeld 300 ms/);
    expect(md).toMatch(/Sonnet-judge: gemiddeld 6000 ms/);
    expect(md).toContain("$0.000200");
    expect(md).toContain("$0.050000 (API-lijstprijs)");
    const viaCode = judgeJevReport({
      date: "2026-11-13",
      jevModel: "typesafe/jev-1.14",
      judgeModel: "claude-code::claude-sonnet-5-5",
      rows,
      jevMs: [200],
      judgeMs: [5000],
      jevCostUsd: 0.0002,
      judgeCostUsd: 0.05,
    });
    expect(viaCode).toMatch(/via Claude Code.*opstarten/);
    expect(md).not.toMatch(/via Claude Code/);
    expect(md).toMatch(/\| visit-prep \| a#1 \| invented \| fail \| pass \|/);
  });

  it("scores both judges against Bastiaan's labels where they disagree", () => {
    const rows = [
      row({ check: "invented", jev: "fail", sonnet: false }),
      row({ check: "aboutAStudent", jev: "pass", sonnet: true }),
      row({ check: "judged", jev: "pass", sonnet: false }),
    ];
    const labels = { [rowKey(rows[0] as JudgeRow)]: true, [rowKey(rows[1] as JudgeRow)]: true };
    expect(rowKey(rows[0] as JudgeRow)).toBe("visit-prep/a#1/invented");
    expect(scoreLabels(rows, labels)).toEqual({ labelled: 2, jevRight: 1, judgeRight: 1 });
  });
});

describe("the judge's cost", () => {
  it("is the usage at the catalog's dollar list price", () => {
    const usage = { input: 10_000, output: 500, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
    expect(listPriceUsd(usage, { currency: "USD", input: 2, output: 10 })).toBeCloseTo(0.025);
    expect(listPriceUsd(usage, { currency: "EUR", input: 2, output: 10 })).toBeUndefined();
    expect(listPriceUsd(usage, undefined)).toBeUndefined();
  });

  it("through Claude Code is the pinned model's list price, so a subscription run is priced too", () => {
    const api = catalogPrice("claude-sonnet-5-5");
    expect(api).toMatchObject({ currency: "USD" });
    expect(catalogPrice("claude-code::claude-sonnet-5-5")).toEqual(api);
    expect(catalogPrice("claude-code::no-such-model")).toBeUndefined();
  });
});
