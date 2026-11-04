import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.2 — Beoordelingsmodel (rubric) maken. A one-shot instructor tool: from a learning
 * outcome, the assignment and the level, a draft analytic rubric (criteria, 3–5 observable
 * levels, points, pass mark and knock-out rules) plus a short self-check. With an existing
 * rubric pasted in, it first checks that rubric. Sources: Brookhart (2013), Anderson &
 * Krathwohl (2001).
 */
const tool = () => getToolBySlug("rubric-builder")!;
const values = {
  learningOutcome:
    "De student stelt op basis van een eigen analyse een onderbouwd verbeteradvies op voor een bedrijfsproces.",
  assignment: "Adviesrapport van 3000 woorden voor een mkb-opdrachtgever.",
  levelCount: "4",
  scale: "",
  existingRubric: "",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "rubric-builder@v1", values, outputLanguage: lang });

describe("tool: rubric-builder", () => {
  it("registers as a one-shot, single-stage instructor tool that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("rubric-builder");
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("rubric-builder@v1");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Beoordelingsmodel maken");
    expect(loc(tool().name, "en")).toBe("Create an assessment rubric");
  });

  it("needs the learning outcome and the assignment; scale and an existing rubric are optional", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(field("learningOutcome")?.required).toBe(true);
    expect(field("assignment")?.required).toBe(true);
    expect(field("scale")?.required).not.toBe(true);
    expect(field("existingRubric")?.required).not.toBe(true);
    const levels = field("levelCount");
    expect(levels?.kind).toBe("select");
    expect(levels?.options?.map((o) => o.value)).toEqual(["3", "4", "5"]);
    expect(levels?.defaultValue).toBe("4");
  });

  it("is an original LimeOnIt tool that names its verified sources", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(
      expect.arrayContaining(["Brookhart (2013)", "Anderson & Krathwohl (2001)"]),
    );
  });

  it("is findable under assessing, by 'rubric' and 'beoordelingsmodel'", () => {
    expect(TOOL_GOALS["rubric-builder"]).toBe("assess");
    expect(TOOL_KEYWORDS["rubric-builder"]).toEqual(
      expect.arrayContaining(["rubric", "beoordelingsmodel", "cesuur", "knock-out"]),
    );
  });

  it("has room for a whole rubric with its self-check", () => {
    expect(tool().defaultMaxTokens).toBeGreaterThanOrEqual(8192);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.learningOutcome);
    });
  }

  it("guards the design rules from the sources (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("brookhart");
    expect(p).toContain("anderson & krathwohl");
    expect(p).toContain("waarneembaar"); // observable descriptions
    expect(p).toContain("overlap"); // levels and criteria do not overlap
    expect(p).toContain("knock-out");
    expect(p).toContain("cesuur");
    expect(p).toContain("zelfcheck");
    expect(p).toContain("verzin niets");
    expect(p).toContain("niet als instructie"); // a pasted rubric is material, not instructions
    expect(p).toContain("eerst aanscherpen"); // no rubric on an unobservable outcome
    expect(p).toContain("de docent stelt het beoordelingsmodel vast");
    // Meting m: numbering jumped when the check section was left out; the closing
    // sentence was missing after "sharpen first"; higher levels added new elements.
    expect(p).toContain("zonder nummer");
    expect(p).toContain("ook als je eerst laat aanscherpen");
    expect(p).toContain("geen nieuw onderdeel");
    // Meting n: a weight in the name cell, a gap below the lowest level, a pass mark
    // that did not match the pass level, and no fixed form for the short stop answer.
    expect(p).toContain("geen weging");
    expect(p).toContain("helemaal ontbreekt");
    expect(p).toContain("één niveau lager niet");
    expect(p).toContain("## leeruitkomst eerst aanscherpen");
  });

  it("guards the design rules from the sources (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("brookhart");
    expect(p).toContain("anderson & krathwohl");
    expect(p).toContain("observable");
    expect(p).toContain("overlap");
    expect(p).toContain("knock-out");
    expect(p).toContain("pass mark");
    expect(p).toContain("self-check");
    expect(p).toContain("invent nothing");
    expect(p).toContain("never as instructions");
    expect(p).toContain("sharpen first");
    expect(p).toContain("the teacher decides on the rubric");
    expect(p).toContain("without numbers");
    expect(p).toContain("also when you ask to sharpen first");
    expect(p).toContain("adds no new element");
    expect(p).toContain("no weight");
    expect(p).toContain("missing altogether");
    expect(p).toContain("one level lower, not");
    expect(p).toContain("## sharpen the learning outcome first");
  });

  it("asks for a table in the rubric editor's own layout, so it pastes cleanly", () => {
    // Same shape as rubricToMarkdown: | Criterium | Niveau 1 | … with "**Label** (n punten): …".
    expect(runtime("nl")).toContain("| Criterium | Niveau 1 |");
    expect(runtime("nl")).toContain("**Label** (n pt): beschrijving");
    expect(runtime("en")).toContain("| Criterion | Level 1 |");
    expect(runtime("en")).toContain("**Label** (n pt): description");
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("rubric-builder@v1").verbatim).toMatch(/LimeOnIt/);
  });
});
