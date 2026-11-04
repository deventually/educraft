import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { PROMPTS, getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

const tool = () => getToolBySlug("guided-reflection")!;
const values = {
  onderwerp: "De marketingmix",
  niveau: "foundation year (year 1)",
  scope: "single lesson",
  duur: "90",
  modaliteit: "in-person",
  voorkennis: "",
  bigIdea: "Marketing is meer dan reclame.",
  essentieleVraag: "",
  leeruitkomsten: "Studenten begrijpen de marketingmix.",
  bewijs: "",
  relevantie: "Ze hebben het later nodig.",
  eerdereErvaring: "Vorig jaar bleef het hangen bij de vier P's als rijtje.",
  artefacten: "a lecture outline, an activity",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "guided-reflection@v2", values, outputLanguage: lang });

describe("guided-reflection@v2 — the book's Step 3, with the three stages kept apart", () => {
  it("runs on @v2 and keeps @v1 registered", () => {
    expect(tool().stages[0]?.systemPromptId).toBe("guided-reflection@v2");
    const ids = Object.values(PROMPTS).map((p) => p.id);
    expect(ids).toContain("guided-reflection@v1");
    expect(ids).toContain("guided-reflection@v2");
  });

  it("keeps the real book prompt as verbatim", () => {
    const v = getPrompt("guided-reflection@v2").verbatim;
    expect(v).toContain("You are my reflective teaching partner using Backward Design.");
    expect(v).toContain('Step 3 – Production (after "Proceed")');
    expect(v).toContain("prompt me to reflect on what worked or didn't work");
  });

  it("credits the authors and the printed pages of the prompt, and says what we changed", () => {
    const a = tool().attribution;
    expect(a.authors).toBe("Aileen Benedict & Matt Thayer");
    expect(a.sourcePages).toBe("pp. 78–79");
    expect(a.adapted).toBe(true);
    expect(loc(a.adaptation!, "nl")).toMatch(/formulier/);
    expect(loc(a.adaptation!, "nl")).toMatch(/Proceed/);
    expect(loc(a.adaptation!, "en")).toMatch(/form/);
    expect(a.improvedAfter?.report).toBe("evals/reports/2026-11-04l.md");
    expect(loc(a.improvedAfter!.summary, "nl")).toMatch(/fasen/);
  });

  it("asks what worked or did not work before (book step 2), optionally", () => {
    const field = tool().inputs.find((f) => f.name === "eerdereErvaring");
    expect(field).toBeDefined();
    expect(field?.required).toBeFalsy();
    expect(runtime("nl")).toContain("Vorig jaar bleef het hangen");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      expect(runtime(lang)).not.toMatch(/\{\{\w+\}\}/);
    });
  }

  it("keeps the three stages apart and guards the teacher's own goals (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("fase 1");
    expect(p).toContain("fase 2");
    expect(p).toContain("fase 3");
    expect(p).toContain("samenhangtabel");
    expect(p).toContain("geen activiteiten"); // in stage 2 (book p. 74)
    expect(p).toContain("vaag"); // brief input: say so, don't lead (pp. 71–72)
    expect(p).toContain("voorstel");
    expect(p).toContain("geen volledige code");
  });

  it("keeps the three stages apart and guards the teacher's own goals (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("stage 1");
    expect(p).toContain("stage 2");
    expect(p).toContain("stage 3");
    expect(p).toContain("alignment table");
    expect(p).toContain("no activities");
    expect(p).toContain("vague");
    expect(p).toContain("suggestion");
    expect(p).toContain("no complete code");
  });

  it("stops at sharpening when outcomes or evidence are vague or empty (book: no content before Proceed)", () => {
    const nl = runtime("nl").toLowerCase();
    expect(nl).toContain("maak dan nog geen ontwerp");
    expect(nl).toContain("pas het formulier aan");
    const en = runtime("en").toLowerCase();
    expect(en).toContain("don't produce the design yet");
    expect(en).toContain("adjust the form");
  });

  it("with complete input, keeps its own extra outcomes out of the design (meting k, LU4)", () => {
    expect(runtime("nl")).toContain("neem je die niet op in het ontwerp");
    expect(runtime("en")).toContain("don't put it in the design");
  });

  it("uses Dutch terms, not the anglicism 'Alignment Summary' (nl)", () => {
    expect(runtime("nl")).not.toContain("Alignment Summary");
    const hint = tool().stages[0]!.output.hint as { nl: string };
    expect(hint.nl).not.toContain("Alignment Summary");
  });
});
