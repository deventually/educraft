import { getToolBySlug } from "~/lib/registry";
import {
  evalGreeting,
  scoresForNextRun,
  unjudgeableReason,
} from "../../scripts/eval-helpers";
import { describe, it, expect } from "vitest";
import {
  clampScore,
  parseJudgeResult,
  averageScore,
  formatDelta,
  reportRowKey,
  buildReportMarkdown,
  type ReportRow,
} from "../../scripts/eval-helpers";

describe("clampScore", () => {
  it("clamps into the 1–5 band and rounds to an integer", () => {
    expect(clampScore(7)).toBe(5);
    expect(clampScore(0)).toBe(1);
    expect(clampScore(-3)).toBe(1);
    expect(clampScore(3.6)).toBe(4);
    expect(clampScore(3.4)).toBe(3);
    expect(clampScore(5)).toBe(5);
  });
});

describe("parseJudgeResult", () => {
  it("parses a clean JSON object and clamps every score", () => {
    const r = parseJudgeResult(
      '{"scores":{"taskFidelity":7,"formatAdherence":0,"levelFit":4.6},"worst":"format","verdict":"solid"}',
    );
    expect(r).not.toBeNull();
    expect(r?.scores).toEqual({ taskFidelity: 5, formatAdherence: 1, levelFit: 5 });
    expect(r?.worst).toBe("format");
    expect(r?.verdict).toBe("solid");
  });

  it("tolerates a ```json fenced block with surrounding prose", () => {
    const raw =
      'Here is my verdict:\n```json\n{"scores":{"taskFidelity":4},"worst":"none","verdict":"ok"}\n```\nDone.';
    const r = parseJudgeResult(raw);
    expect(r?.scores.taskFidelity).toBe(4);
  });

  it("returns null on malformed / non-JSON input", () => {
    expect(parseJudgeResult("not json at all")).toBeNull();
    expect(parseJudgeResult("")).toBeNull();
    expect(parseJudgeResult("{ broken: ")).toBeNull();
  });

  it("returns null when there is no usable scores object", () => {
    expect(parseJudgeResult('{"worst":"x","verdict":"y"}')).toBeNull();
    expect(parseJudgeResult('{"scores":{}}')).toBeNull();
    expect(parseJudgeResult('{"scores":{"taskFidelity":"high"}}')).toBeNull();
  });

  it("defaults worst/verdict to empty strings when absent", () => {
    const r = parseJudgeResult('{"scores":{"taskFidelity":3}}');
    expect(r?.worst).toBe("");
    expect(r?.verdict).toBe("");
  });
});

describe("averageScore", () => {
  it("means the values, rounded to two decimals", () => {
    expect(averageScore({ a: 3, b: 3 })).toBe(3);
    expect(averageScore({ a: 4, b: 5 })).toBe(4.5);
    expect(averageScore({ a: 4, b: 4, c: 5 })).toBe(4.33);
  });

  it("returns 0 for an empty score set", () => {
    expect(averageScore({})).toBe(0);
  });
});

describe("formatDelta", () => {
  it("renders an em dash when there is no previous value", () => {
    expect(formatDelta(4.5, undefined)).toBe("—");
  });

  it("renders a signed two-decimal delta against the previous value", () => {
    expect(formatDelta(3, 2.5)).toBe("+0.50");
    expect(formatDelta(2, 2.5)).toBe("-0.50");
    expect(formatDelta(3, 3)).toBe("+0.00");
  });
});

describe("buildReportMarkdown", () => {
  const rows: ReportRow[] = [
    {
      tool: "forum-autograder",
      caseId: "b-thread",
      scores: { taskFidelity: 4, formatAdherence: 5 },
      model: "claude-sonnet-4-6",
      promptWords: 480,
    },
    {
      tool: "forum-autograder",
      caseId: "a-thread",
      scores: { taskFidelity: 3, formatAdherence: 3 },
      model: "claude-sonnet-4-6",
      promptWords: 480,
    },
  ];

  it("keys a row stably by tool + case", () => {
    expect(reportRowKey(rows[0])).toBe("forum-autograder/b-thread");
  });

  it("produces deterministic markdown with avg, delta, model and prompt words", () => {
    const input = {
      date: "2026-07-05",
      rows,
      previousAvgByKey: { "forum-autograder/a-thread": 2.5 },
    };
    const md = buildReportMarkdown(input);
    // Deterministic regardless of input row order.
    expect(md).toBe(buildReportMarkdown(input));
    // Sorted by (tool, case): a-thread precedes b-thread.
    expect(md.indexOf("a-thread")).toBeLessThan(md.indexOf("b-thread"));
    // Header carries the run date.
    expect(md).toContain("2026-07-05");
    // Case a: avg (3+3)/2 = 3.00, delta vs 2.5 = +0.50.
    expect(md).toContain("3.00");
    expect(md).toContain("+0.50");
    // Case b: avg (4+5)/2 = 4.50, no previous → em dash.
    expect(md).toContain("4.50");
    expect(md).toContain("—");
    // Run metadata + per-criterion columns.
    expect(md).toContain("claude-sonnet-4-6");
    expect(md).toContain("480");
    expect(md).toContain("taskFidelity");
    expect(md).toContain("formatAdherence");
  });

  it("handles an empty run without throwing", () => {
    expect(() => buildReportMarkdown({ date: "2026-07-05", rows: [] })).not.toThrow();
  });
});

describe("chat greeting in the eval transcript (nulmeting 2026-11-04)", () => {
  it("fills greeting placeholders from the case values, as the app does", () => {
    const tool = getToolBySlug("scaffolding-feedback");
    expect(tool).toBeDefined();
    const g = evalGreeting(tool!, {
      outputLanguage: "nl",
      values: { subject: "lineaire vergelijkingen" },
    });
    expect(g).toContain("lineaire vergelijkingen");
    expect(g).not.toContain("{{");
  });

  it("is undefined for a tool without a greeting", () => {
    expect(
      evalGreeting(getToolBySlug("arcs-reactor")!, { outputLanguage: "nl", values: {} }),
    ).toBeUndefined();
  });
});

describe("unjudgeableReason (second measurement 2026-11-04)", () => {
  // guided-reflection eqf6 came back empty twice; the judge still scored it 3.6.
  it("refuses an empty or whitespace-only one-shot output", () => {
    expect(unjudgeableReason("")).toMatch(/empty/);
    expect(unjudgeableReason("  \n\t ")).toMatch(/empty/);
  });

  it("refuses a chat transcript with an empty tutor turn", () => {
    const t = "**Student:** hoi\n\n**Tutor:** \n\n**Student:** en nu?\n\n**Tutor:** Goed.";
    expect(unjudgeableReason(t)).toMatch(/empty tutor turn/);
  });

  it("accepts normal output and a complete transcript", () => {
    expect(unjudgeableReason("# Lesplan\n\nFase 1 …")).toBeNull();
    expect(
      unjudgeableReason("**Tutor (greeting):** Hoi\n\n**Student:** hoi\n\n**Tutor:** Dag!"),
    ).toBeNull();
  });
});

describe("a case that was not judged", () => {
  const rows: ReportRow[] = [
    { tool: "a", caseId: "x", scores: { taskFidelity: 5 }, model: "m", promptWords: 1 },
    { tool: "b", caseId: "empty", scores: {}, model: "m", promptWords: 1 },
  ];

  it("shows as not judged in the report, without a score or a delta", () => {
    const md = buildReportMarkdown({ date: "d", rows, previousAvgByKey: { "b/empty": 3.6 } });
    const line = md.split("\n").find((l) => l.includes("| empty |"))!;
    expect(line).toContain("not judged");
    expect(line).not.toContain("0.00");
    expect(line).not.toMatch(/-3\.60/);
    expect(md).toContain("Cases scored: 1 of 2");
  });

  it("is left out of the scores the next run compares with", () => {
    expect(scoresForNextRun(rows)).toEqual({ "a/x": 5 });
  });
});
