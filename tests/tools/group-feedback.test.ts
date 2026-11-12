import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { UTILITIES } from "~/lib/utilities";

/**
 * P36.2 — Groepsfeedback maken. One debrief for the whole group after marking, from counts made
 * in code (the rubric's "Hoe ging de groep", P36.1, or the test analysis). No student work is
 * needed; example fragments go through the name check in the browser. A number in digits that is
 * not in the input is dropped in code (`output.guard`).
 */
const tool = () => getToolBySlug("group-feedback")!;
const values = {
  groupSummary:
    "Ronde 2026-11, 12 werken, beoordeeld met de rubric.\n- Bronnen: 7 van 12 op het laagste niveau (58%). Niveaus: Onvoldoende 7, Voldoende 3, Goed 2.",
  examples: "Er staat geen bronvermelding bij de grafiek.",
  assignment: "Onderzoeksverslag marktanalyse",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "group-feedback@v1", values, outputLanguage: lang });

describe("tool: group-feedback", () => {
  it("registers as a one-shot tool for teachers with one stage", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages.map((s) => s.systemPromptId)).toEqual(["group-feedback@v1"]);
    expect(t.enabled).toBe(true);
    // Example fragments are student work: never in a shared view.
    expect(t.handlesStudentWork).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Groepsfeedback maken");
    expect(loc(tool().name, "en")).toBe("Make group feedback");
  });

  it("asks for the counts, optional anonymised examples and the assignment", () => {
    const t = tool();
    expect(t.inputs.map((f) => f.name)).toEqual(["groupSummary", "examples", "assignment"]);
    const [summary, examples, assignment] = t.inputs;
    expect(summary?.kind).toBe("textarea");
    expect(summary?.required).toBe(true);
    expect(loc(summary?.help, "nl").toLowerCase()).toContain("geen namen");
    expect(loc(summary?.help, "en").toLowerCase()).toContain("no names");
    expect(examples?.required).not.toBe(true);
    expect(examples?.redact).toBe(true);
    expect(assignment?.required).not.toBe(true);
    expect(assignment?.prefillFromCourse).toEqual({ source: "itemTitle" });
  });

  it("is a Word document whose numbers come from the input only", () => {
    const out = tool().stages[0].output;
    expect(out.exportAs).toBe("document");
    expect(out.guard).toBe("input-numbers");
  });

  it("follows the test analysis, and is what the rubric page hands its counts to", () => {
    expect(getToolBySlug("test-analysis")?.next).toContain("group-feedback");
    expect(UTILITIES.find((u) => u.id === "rubric")?.explainWith).toBe("group-feedback");
  });

  it("is an original LimeOnIt tool, findable under assessing", () => {
    expect(tool().attribution.original).toBe(true);
    expect(getPrompt("group-feedback@v1").verbatim).toMatch(/LimeOnIt/);
    expect(TOOL_GOALS["group-feedback"]).toBe("assess");
    expect(TOOL_KEYWORDS["group-feedback"]).toEqual(
      expect.arrayContaining(["groepsfeedback", "nabespreking", "feedforward", "group feedback"]),
    );
  });

  it("has a help page in both languages that says it needs no names", () => {
    expect(getToolHelpOverlay("group-feedback", "nl")).toMatch(/geen namen/i);
    expect(getToolHelpOverlay("group-feedback", "en")).toMatch(/no names/i);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.groupSummary);
      expect(p).toContain(values.examples);
      expect(p).toContain(values.assignment);
    });
  }

  it("guards the brief's demands (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    for (const h of ["## nabespreking", "## tekst voor de groep", "**hoeveel:**", "**oefening"]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("drie tot vijf");
    // Principle 2: counting is code; any other number is written in words.
    expect(p).toContain("neem elk getal letterlijk over uit de invoer");
    expect(p).toContain("schrijf je in letters");
    // The example is made up and marked so, never a student's fragment.
    expect(p).toContain("*zelfgemaakt voorbeeld:*");
    expect(p).toContain("nooit een zin of stuk uit de voorbeeldfouten");
    // Principle 3: about the work of the group, no judgement about persons.
    expect(p).toContain("over het werk van de groep");
    expect(p).toContain(
      "de aantallen zijn geteld door limeonit, niet door de ai. jij kiest wat je bespreekt.",
    );
  });

  it("guards the brief's demands (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    for (const h of ["## debrief", "## text for the group", "**how many:**", "**exercise"]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("three to five");
    expect(p).toContain("copy every number literally from the input");
    expect(p).toContain("write it in words");
    expect(p).toContain("*made-up example:*");
    expect(p).toContain("never a sentence or passage from the example mistakes");
    expect(p).toContain("about the work of the group");
    expect(p).toContain(
      "the counts were made by limeonit, not by the ai. you choose what to discuss.",
    );
  });
});
