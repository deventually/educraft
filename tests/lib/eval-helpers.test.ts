import { getToolBySlug } from "~/lib/registry";
import {
  batchableModel,
  caseValues,
  generationModel,
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
  JUDGE_MAX_TOKENS,
  judgeFileName,
  judgeRecord,
  rubricForJudge,
  verifyEvidence,
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

  it("salvages scores and checks when a quote in the prose breaks the JSON (meting dyw3)", () => {
    const raw =
      '{"scores": {"taskFidelity": 4, "levelFit": 3}, "checks": {"severalQuestions": false, "acceptedVagueAnswer": true}, "worst": "accepted "human error" too quickly", "verdict": "ok"}';
    const r = parseJudgeResult(raw);
    expect(r?.scores).toEqual({ taskFidelity: 4, levelFit: 3 });
    expect(r?.failedChecks).toEqual(["acceptedVagueAnswer"]);
    expect(r?.worst).toContain("human error");
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
    expect(reportRowKey(rows[0]!)).toBe("forum-autograder/b-thread");
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

  it("says how many runs the judge could not score, instead of averaging silently", () => {
    // Meting g: the judge returned no JSON in 3 of 12 runs; a 1-run mean read as a 3-run mean.
    const md = buildReportMarkdown({
      date: "2026-11-04",
      rows: [
        {
          tool: "dialogic-encounters",
          caseId: "piaget",
          scores: { taskFidelity: 4 },
          model: "m",
          promptWords: 10,
          runs: 3,
          notJudgedRuns: 2,
          spread: [3.8, 3.8],
        },
      ],
    });
    expect(md).toContain("3 (3.80–3.80; 2 not judged)");
  });
});

describe("judge budget", () => {
  it("retries the judge with more room before giving up", () => {
    expect(JUDGE_MAX_TOKENS).toEqual([2048, 4096]);
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
      const section = rubric.split(/^##\s+hard checks.*$/im)[1]!.split(/^##\s/m)[0];
      const bullets = section!.split("\n").filter((l) => /^-\s+\*\*/.test(l.trim()));
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
    expect(COUNTED_CHECKS.longTurn!(transcript)).toBe(true);
    expect(COUNTED_CHECKS.longTurn!("**Tutor:** Kort en goed. Wat denk je?")).toBe(false);
    expect(COUNTED_CHECKS.longTurn!(`**Tutor:** ${"woord ".repeat(151)}`)).toBe(true);
    expect(COUNTED_CHECKS.longTurn!(`**Tutor:** ${"woord ".repeat(140)}`)).toBe(false);
    expect(COUNTED_CHECKS.longTurn!("**Tutor:** **Jouw beurt:** wat denk je?")).toBe(true);
    expect(COUNTED_CHECKS.longTurn!("**Tutor:** ### Stap\nwat denk je?")).toBe(true);
  });

  it("severalQuestions fails on more than one question mark in a tutor turn", () => {
    expect(COUNTED_CHECKS.severalQuestions!(transcript)).toBe(false);
    expect(COUNTED_CHECKS.severalQuestions!("**Tutor:** Wat is f? En wat is g?")).toBe(true);
  });

  it("compoundQuestion fails on two questions in one sentence with one question mark (meting dyw4)", () => {
    const fails = [
      "Dat is te vaag. Welke fout precies, en wat doet die met je resultaat?",
      "Maakt die griepperiode het verschil groter of kleiner, en hoe weet je dat?",
      "Verwacht je bij opgelost natriumacetaat een pH onder, rond of boven 7, en waarom?",
      "Hoe kwam je aan die 62 studenten, en in hoeverre lijken zij op je klanten?",
      "Welke zorginterventie heb je ingezet, en waarom koos je juist die?",
      "Which error exactly, and what does it do to your result?",
      "Was it larger or smaller, and how do you know?",
    ];
    for (const q of fails)
      expect(COUNTED_CHECKS.compoundQuestion!(`**Tutor:** Goed. ${q}`), q).toBe(true);
    const passes = [
      "Wat zou er nog meer veranderd kunnen zijn op je afdeling, los van de screening?",
      "Maakt die fout je uitkomst groter of kleiner?",
      "Welke bron, techniek of doelgroep koos je?",
      "Je noemt 9 en 4, en dat is een verschil. Wat zegt dat verschil volgens jou?",
      "What did your data show, step by step?",
    ];
    for (const q of passes)
      expect(COUNTED_CHECKS.compoundQuestion!(`**Tutor:** ${q}`), q).toBe(false);
    // The fixed greeting is not the model's.
    expect(
      COUNTED_CHECKS.compoundQuestion!(
        "**Tutor (greeting):** Wat deed je, en waarom?\n\n**Student:** x",
      ),
    ).toBe(false);
  });

  it("shows the judge the rubric without its hard-check section (meting dyw4)", () => {
    const rubric =
      "# Rubric\n\n- **taskFidelity** — does it.\n\n## Hard checks\n\nIntro.\n\n- **severalQuestions** (cap 2, counted): more than one question mark?\n- **gaveGrade** (cap 2): a grade?\n\n## Notes\n\nKeep me.";
    const shown = rubricForJudge(rubric);
    expect(shown).toContain("taskFidelity");
    expect(shown).toContain("Keep me.");
    expect(shown).not.toContain("severalQuestions");
    expect(shown).not.toContain("question mark");
    // The judged checks still reach the judge, through the HARD CHECKS instruction.
    expect(hardChecksInstruction(parseHardChecks(rubric))).toContain('"gaveGrade"');
  });

  it("asks the judge for a verbatim quote per failed check", () => {
    const text = hardChecksInstruction(
      parseHardChecks("## Hard checks\n- **gaveGrade** (cap 2): grade?"),
    );
    expect(text).toContain('"evidence"');
    expect(text).toContain("verbatim");
  });

  it("keeps a failed check only when its quote is in the transcript (meting dyw4)", () => {
    const out =
      "**Tutor:** Dat is een duidelijk doel. Welke keuze maakte je?\n\n**Student:** Iedereen gebruikt het.\n\n**Tutor:** Goed. Wat zeggen jouw cijfers?";
    const r = verifyEvidence(
      ["acceptedVagueAnswer", "wroteTheDefense", "gaveGrade"],
      {
        // Curly quotes, other spacing and case still match.
        acceptedVagueAnswer: "iedereen  gebruikt het",
        // An invented quote (internship run 5).
        wroteTheDefense: "Precies, als er vallen niet zijn gemeld",
      },
      out,
    );
    expect(r.kept).toEqual(["acceptedVagueAnswer"]);
    expect(r.rejected).toEqual(["wroteTheDefense", "gaveGrade"]);
  });

  it("accepts a quote with an ellipsis when every part is in the transcript", () => {
    const out = "**Tutor:** Dat is een duidelijk doel. Welke keuze maakte je?";
    expect(
      verifyEvidence(["x"], { x: "Dat is een duidelijk doel… Welke keuze" }, out).kept,
    ).toEqual(["x"]);
    expect(verifyEvidence(["x"], { x: "Dat is… iets anders dan dit" }, out).kept).toEqual([]);
  });

  it("parses the judge's evidence", () => {
    const r = parseJudgeResult(
      '{"scores":{"a":4},"checks":{"gaveGrade":true},"evidence":{"gaveGrade":"een 7"},"worst":"","verdict":""}',
    );
    expect(r?.evidence).toEqual({ gaveGrade: "een 7" });
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
    // The rehearsal eval (P29.2) has its own runner and counters.
    const { REHEARSAL_COUNTED } = await import("../../scripts/eval-rehearsal-helpers");
    const own: Record<string, Record<string, unknown>> = {
      "portfolio-rehearsal": REHEARSAL_COUNTED,
    };
    for (const tool of readdirSync("evals")) {
      const path = `evals/${tool}/rubric.md`;
      if (!existsSync(path)) continue;
      for (const c of parseHardChecks(readFileSync(path, "utf8")).filter((c) => c.counted)) {
        expect((own[tool] ?? COUNTED_CHECKS)[c.id], `${tool}/${c.id}`).toBeTypeOf("function");
      }
    }
  });
});

describe("case values", () => {
  it("start from the form's defaults, as in the app, so an optional field a case omits is empty", () => {
    const tool = getToolBySlug("guided-reflection")!;
    const v = caseValues(tool, { onderwerp: "Testen" });
    expect(v.onderwerp).toBe("Testen");
    expect(v.eerdereErvaring).toBe("");
    expect(v.scope).toBe("single lesson");
  });
});

describe("the judge's verdict is kept next to each output (meting n, 2026-11-04)", () => {
  it("names the file after the output, per run", () => {
    expect(judgeFileName("case-a", 1)).toBe("case-a.judge.json");
    expect(judgeFileName("case-a", 3)).toBe("case-a.run3.judge.json");
  });

  it("keeps the scores, failed checks, weakest aspect and verdict", () => {
    const rec = judgeRecord({
      scores: { taskFidelity: 4 },
      failedChecks: ["x"],
      worst: "w",
      verdict: "v",
    });
    expect(JSON.parse(rec)).toEqual({
      scores: { taskFidelity: 4 },
      failedChecks: ["x"],
      worst: "w",
      verdict: "v",
    });
  });

  it("keeps the checks whose quote was not in the output, as judge errors", () => {
    const rec = judgeRecord({
      scores: { taskFidelity: 4 },
      failedChecks: [],
      rejectedChecks: ["wroteTheDefense"],
      evidence: { wroteTheDefense: "Precies, als er vallen…" },
      worst: "w",
      verdict: "v",
    });
    expect(JSON.parse(rec).rejectedChecks).toEqual(["wroteTheDefense"]);
    expect(JSON.parse(rec).evidence).toEqual({ wroteTheDefense: "Precies, als er vallen…" });
  });
});

describe("--model: generate with another model, judge with the same one", () => {
  const tool = getToolBySlug("mentorai")!;
  const stage = tool.stages[0];

  it("uses the stage's or tool's own model without an override", () => {
    expect(generationModel(tool, stage!)).toBe(stage!.model ?? tool.defaultModel);
  });

  it("uses the override for every stage, also a pinned one", () => {
    expect(generationModel(tool, { ...stage!, model: "claude-haiku-5-5" }, "gpt-6.1-sol")).toBe(
      "gpt-6.1-sol",
    );
  });

  it("accepts catalog and local models, refuses an unknown id before anything is paid", () => {
    expect(generationModel(tool, stage!, "gemini-4-argon")).toBe("gemini-4-argon");
    expect(generationModel(tool, stage!, "ollama::qwen3:32b")).toBe("ollama::qwen3:32b");
    expect(() => generationModel(tool, stage!, "gpt-nonexistent")).toThrow(/gpt-nonexistent/);
  });

  it("batches only Anthropic models (the Message Batches API is Anthropic's)", () => {
    expect(batchableModel("claude-sonnet-5-5")).toBe(true);
    expect(batchableModel("gpt-6.1-sol")).toBe(false);
    expect(batchableModel("ollama::qwen3:32b")).toBe(false);
  });
});
