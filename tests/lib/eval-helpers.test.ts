import { getToolBySlug } from "~/lib/registry";
import { evalGreeting, scoresForNextRun, unjudgeableReason } from "../../scripts/eval-helpers";
import { describe, it, expect } from "vitest";
import {
  clampScore,
  parseJudgeResult,
  averageScore,
  formatDelta,
  reportRowKey,
  buildReportMarkdown,
  type ReportRow,
  parseHardChecks,
  applyHardChecks,
  hardChecksInstruction,
  meanScores,
  runSpread,
  capTruncated,
  TRUNCATION_CAP,
  tutorTurns,
  COUNTED_CHECKS,
  countedFailures,
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

describe("hard checks (stricter measurement, 2026-11-04)", () => {
  const rubric = [
    "# Rubric",
    "- **taskFidelity** — not a check",
    "",
    "## Hard checks",
    "",
    "- **gaveAnswer** (cap 2): Did the mentor state the final answer to the student's own task?",
    "- **inventedQuote** (cap 3): Did the mentor attribute words to the student that the student never wrote?",
    "",
    "## Other section",
    "- **notACheck** (cap 1): ignored, outside the section",
  ].join("\n");

  it("reads the checks from the Hard checks section only", () => {
    expect(parseHardChecks(rubric)).toEqual([
      {
        id: "gaveAnswer",
        cap: 2,
        question: "Did the mentor state the final answer to the student's own task?",
      },
      {
        id: "inventedQuote",
        cap: 3,
        question: "Did the mentor attribute words to the student that the student never wrote?",
      },
    ]);
  });

  it("returns no checks for a rubric without the section", () => {
    expect(parseHardChecks("# Rubric\n- **x** (cap 2): y")).toEqual([]);
  });

  it("parses the failed checks from the judge reply (true = the failure happened)", () => {
    const r = parseJudgeResult(
      '{"scores":{"taskFidelity":5},"checks":{"gaveAnswer":true,"inventedQuote":false},"worst":"","verdict":""}',
    );
    expect(r?.failedChecks).toEqual(["gaveAnswer"]);
    expect(parseJudgeResult('{"scores":{"taskFidelity":5}}')?.failedChecks).toEqual([]);
  });

  it("caps every criterion at the lowest cap of the failed checks", () => {
    const checks = parseHardChecks(rubric);
    expect(applyHardChecks({ a: 5, b: 1 }, ["gaveAnswer", "inventedQuote"], checks)).toEqual({
      a: 2,
      b: 1,
    });
    expect(applyHardChecks({ a: 5 }, ["inventedQuote"], checks)).toEqual({ a: 3 });
    expect(applyHardChecks({ a: 5 }, [], checks)).toEqual({ a: 5 });
    // An id the rubric does not define caps nothing.
    expect(applyHardChecks({ a: 5 }, ["unknown"], checks)).toEqual({ a: 5 });
  });

  it("lists the checks in the judge instructions, or nothing without checks", () => {
    const text = hardChecksInstruction(parseHardChecks(rubric));
    expect(text).toContain('"gaveAnswer"');
    expect(text).toContain("cap 2");
    expect(text).toContain("true");
    expect(hardChecksInstruction([])).toBe("");
  });
});

describe("several runs per case", () => {
  it("means each criterion over the judged runs, two decimals", () => {
    expect(
      meanScores([
        { a: 4, b: 5 },
        { a: 5, b: 5 },
        { a: 4, b: 2 },
      ]),
    ).toEqual({ a: 4.33, b: 4 });
  });

  it("skips not-judged runs and is empty when none was judged", () => {
    expect(meanScores([{ a: 4 }, {}])).toEqual({ a: 4 });
    expect(meanScores([{}, {}])).toEqual({});
  });

  it("gives the lowest and highest run average", () => {
    expect(runSpread([{ a: 4, b: 5 }, { a: 2, b: 2 }, {}])).toEqual([2, 4.5]);
    expect(runSpread([{}])).toBeUndefined();
  });

  it("shows runs, spread and failed checks in the report", () => {
    const md = buildReportMarkdown({
      date: "2026-11-04",
      rows: [
        {
          tool: "mentorai",
          caseId: "fishing",
          scores: { taskFidelity: 2 },
          model: "m",
          promptWords: 10,
          runs: 3,
          spread: [1.5, 2.5],
          failedChecks: ["gaveAnswer"],
        },
      ],
    });
    expect(md).toContain("Runs");
    expect(md).toContain("3 (1.50–2.50)");
    expect(md).toContain("Failed checks");
    expect(md).toContain("gaveAnswer");
  });
});

describe("hard checks in the committed rubrics", () => {
  it("every rubric with a Hard checks section defines checks the parser reads", async () => {
    const { readdirSync, readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(process.cwd(), "evals");
    for (const tool of readdirSync(dir)) {
      const path = join(dir, tool, "rubric.md");
      if (!existsSync(path)) continue;
      const rubric = readFileSync(path, "utf8");
      if (!/^##\s+hard checks/im.test(rubric)) continue;
      const section = rubric.split(/^##\s+hard checks.*$/im)[1].split(/^##\s/m)[0];
      const bullets = section.split("\n").filter((l) => /^-\s+\*\*/.test(l.trim()));
      expect(parseHardChecks(rubric).length, tool).toBe(bullets.length);
      expect(bullets.length, tool).toBeGreaterThan(0);
    }
  });

  it("MentorAI caps a conversation that hands over the answer", async () => {
    const { readFileSync } = await import("node:fs");
    const rubric = readFileSync("evals/mentorai/rubric.md", "utf8");
    const checks = parseHardChecks(rubric);
    expect(checks.find((c) => c.id === "gaveAnswer")?.cap).toBe(2);
    expect(checks.find((c) => c.id === "inventedStudentWords")?.cap).toBe(2);
  });
});

describe("a cut-off answer is capped", () => {
  it("caps every score at the truncation cap (meting d: a cut-off answer still got 4.67)", () => {
    expect(TRUNCATION_CAP).toBe(3);
    expect(capTruncated({ a: 5, b: 2 })).toEqual({ a: 3, b: 2 });
  });
});

describe("counted checks (decided in code, not by the judge)", () => {
  const transcript = [
    "**Tutor (greeting):** Welkom! Ik laat je eerst zien hoe het werkt. Klaar? Echt?",
    "**Student:** Ik snap het niet.",
    "**Tutor:** Prima. Wat weet je al over de kettingregel?",
    "**Student:** Niks.",
    "**Tutor:** Oké.\n\n1. Eerst dit\n2. Dan dat\n\nWat denk je?",
  ].join("\n\n");

  it("marks a check as counted in the rubric", () => {
    const [c] = parseHardChecks(
      "## Hard checks\n- **longTurn** (cap 3, counted): Any turn over 150 words or with lists?",
    );
    expect(c).toEqual({
      id: "longTurn",
      cap: 3,
      question: "Any turn over 150 words or with lists?",
      counted: true,
    });
  });

  it("splits the tutor turns, leaving out the fixed greeting", () => {
    expect(tutorTurns(transcript)).toEqual([
      "Prima. Wat weet je al over de kettingregel?",
      "Oké.\n\n1. Eerst dit\n2. Dan dat\n\nWat denk je?",
    ]);
  });

  it("longTurn fails on a list, a heading or more than 150 words, not on the greeting", () => {
    expect(COUNTED_CHECKS.longTurn(transcript)).toBe(true);
    expect(COUNTED_CHECKS.longTurn("**Tutor:** Kort en goed. Wat denk je?")).toBe(false);
    expect(COUNTED_CHECKS.longTurn(`**Tutor:** ${"woord ".repeat(151)}`)).toBe(true);
    expect(COUNTED_CHECKS.longTurn(`**Tutor:** ${"woord ".repeat(140)}`)).toBe(false);
    expect(COUNTED_CHECKS.longTurn("**Tutor:** **Jouw beurt:** wat denk je?")).toBe(true);
    expect(COUNTED_CHECKS.longTurn("**Tutor:** ### Stap\nwat denk je?")).toBe(true);
  });

  it("severalQuestions fails on more than one question mark in a tutor turn", () => {
    expect(COUNTED_CHECKS.severalQuestions(transcript)).toBe(false);
    expect(COUNTED_CHECKS.severalQuestions("**Tutor:** Wat is f? En wat is g?")).toBe(true);
  });

  it("decides counted checks in code and asks the judge only the others", () => {
    const checks = parseHardChecks(
      "## Hard checks\n- **longTurn** (cap 3, counted): lists?\n- **gaveAnswer** (cap 2): answer?",
    );
    expect(countedFailures(checks, transcript)).toEqual(["longTurn"]);
    const text = hardChecksInstruction(checks);
    expect(text).toContain('"gaveAnswer"');
    expect(text).not.toContain('"longTurn"');
    expect(text).toContain("greeting");
  });

  it("every counted check in a committed rubric has a counter", async () => {
    const { readdirSync, readFileSync, existsSync } = await import("node:fs");
    for (const tool of readdirSync("evals")) {
      const path = `evals/${tool}/rubric.md`;
      if (!existsSync(path)) continue;
      for (const c of parseHardChecks(readFileSync(path, "utf8")).filter((c) => c.counted)) {
        expect(COUNTED_CHECKS[c.id], `${tool}/${c.id}`).toBeTypeOf("function");
      }
    }
  });
});
