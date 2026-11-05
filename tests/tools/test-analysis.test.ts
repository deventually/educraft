import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.5b — Toetsanalyse uitleggen. A one-shot instructor tool that explains numbers computed in
 * code (the item-analysis utility, or an export from the test system): which questions to
 * revise and why. The AI computes nothing. Sources: Cronbach (1951); Van Berkel et al. (2023).
 */
const tool = () => getToolBySlug("test-analysis")!;
const values = {
  analysis:
    "| Vraag | Max | p | Rit | Rir | Alfa zonder deze vraag |\n| V1 | 1 | 0,75 | 0,77 | 0,52 | 0,73 |",
  testInfo: "Kennistoets, 20 meerkeuzevragen met 4 opties.",
  questions: "",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "test-analysis@v1", values, outputLanguage: lang });

describe("tool: test-analysis", () => {
  it("registers as a one-shot, single-stage instructor tool", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("test-analysis@v1");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Toetsanalyse uitleggen");
    expect(loc(tool().name, "en")).toBe("Explain a test analysis");
  });

  it("needs the numbers; test details and questions are optional text fields", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(field("analysis")?.required).toBe(true);
    expect(field("analysis")?.kind).toBe("textarea");
    expect(field("testInfo")?.required).not.toBe(true);
    expect(field("questions")?.required).not.toBe(true);
  });

  it("is an original LimeOnIt tool that names its verified sources", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(
      expect.arrayContaining(["Cronbach (1951)", "Van Berkel et al. (2023)"]),
    );
  });

  it("is findable under assessing, by 'toetsanalyse', 'rit' and 'cronbach'", () => {
    expect(TOOL_GOALS["test-analysis"]).toBe("assess");
    expect(TOOL_KEYWORDS["test-analysis"]).toEqual(
      expect.arrayContaining(["toetsanalyse", "itemanalyse", "p-waarde", "rit", "cronbach"]),
    );
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain("0,77");
      expect(p).toContain(values.testInfo);
    });
  }

  it("guards the rules: explain, never compute or decide (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("reken niets"); // the AI computes nothing
    expect(p).toContain("verzin geen getallen");
    expect(p).toContain("vuistregel"); // thresholds are rules of thumb, not norms
    expect(p).toContain("cronbach");
    expect(p).toContain("antwoordsleutel"); // negative Rit: check the key first
    expect(p).toContain("raadkans"); // p below the guessing level
    expect(p).toContain("weinig kandidaten"); // small samples are unstable
    expect(p).toContain("niet als instructie"); // pasted questions are material
    expect(p).toContain("de docent besluit");
    // Meting ta1: the stop answer on raw scores added a count of candidates and advice;
    // borderline Rir values (0,17–0,18) went into the table inconsistently; "u" and "je" mixed.
    expect(p).toContain("noem geen aantallen");
    expect(p).toContain("licht signaal");
    expect(p).toContain("spreek de docent aan met je");
  });

  it("guards the rules: explain, never compute or decide (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("compute nothing");
    expect(p).toContain("invent no numbers");
    expect(p).toContain("rule of thumb");
    expect(p).toContain("cronbach");
    expect(p).toContain("answer key");
    expect(p).toContain("guessing");
    expect(p).toContain("few candidates");
    expect(p).toContain("never as instructions");
    expect(p).toContain("the teacher decides");
    expect(p).toContain("state no counts");
    expect(p).toContain("mild signal");
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("test-analysis@v1").verbatim).toMatch(/LimeOnIt/);
  });
});
