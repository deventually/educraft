import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P31.3 — De leercheck. A one-shot instructor tool that rates an activity on the six
 * principles of the book's Appendix G "Complete Cognitive Engagement Rubric Definitions"
 * (Van Schaack & Sarlo, From Oracle to Socratic Partner, pp. 355–356). The AI picks a level
 * per principle; the score is computed in code (`output.computed`).
 */
const tool = () => getToolBySlug("engagement-check")!;
const values = {
  activity:
    "Practicumverslag: voer de titratie uit in de les en schrijf thuis een verslag met hypothese, werkwijze, tabel, berekening, foutenanalyse en conclusie.",
  learningObjective: "De student legt de keuzes in de proefopzet uit en verdedigt de conclusie.",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "engagement-check@v1", values, outputLanguage: lang });

describe("tool: engagement-check", () => {
  it("registers as a one-shot, single-stage instructor tool that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("engagement-check@v1");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Hoe actief leren je studenten?");
    expect(loc(tool().name, "en")).toBe("How actively do your students learn?");
  });

  it("needs the activity; the learning objective is optional and comes from the course", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(tool().inputs.map((f) => f.name)).toEqual(["activity", "learningObjective"]);
    expect(field("activity")?.required).toBe(true);
    expect(field("activity")?.kind).toBe("document");
    expect(field("learningObjective")?.required).not.toBe(true);
    expect(field("learningObjective")?.prefillFromCourse).toEqual({ source: "learningOutcomes" });
  });

  it("computes the score in code, not in the AI", () => {
    expect(tool().stages[0]?.output.computed).toBe("engagement-index");
  });

  it("credits the book's Appendix G honestly, as an adaptation", () => {
    const a = tool().attribution;
    expect(a.original).not.toBe(true);
    expect(a.authors).toBe("Andy Van Schaack & Roman Sarlo");
    expect(a.sourcePages).toMatch(/Appendix G.*355–356/);
    expect(a.adapted).toBe(true);
    expect(loc(a.adaptation, "nl")).toMatch(/rubric/i);
  });

  it("keeps the book's own text as the verbatim source", () => {
    const v = getPrompt("engagement-check@v1")!.verbatim;
    for (const s of [
      "Retrieval Practice",
      "Spaced Practice",
      "Interleaving",
      "Dual Coding",
      "Concrete Examples",
      "Elaboration",
      "Absent (0): The activity does not incorporate this principle in any form.",
    ]) {
      expect(v).toContain(s);
    }
  });

  it("is findable under planning, by 'actief leren', 'retrieval practice' and 'leerprincipes'", () => {
    expect(TOOL_GOALS["engagement-check"]).toBe("design");
    expect(TOOL_KEYWORDS["engagement-check"]).toEqual(
      expect.arrayContaining([
        "actief leren",
        "retrieval practice",
        "leerprincipes",
        "dual coding",
      ]),
    );
  });

  it("offers a redesign as the next step", () => {
    expect(tool().next).toEqual(["cognitive-architect", "differentiation"]);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.activity);
      expect(p).toContain(values.learningObjective);
    });
  }

  it("guards the rubric and the honest-scoring rules (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("verzin niets");
    for (const h of ["**score per principe**", "**zo maak je het actiever**"]) {
      expect(p, h).toContain(h);
    }
    for (const name of [
      "ophalen uit het geheugen (retrieval practice)",
      "gespreid oefenen (spaced practice)",
      "afwisselen (interleaving)",
      "woord en beeld (dual coding)",
      "concrete voorbeelden (concrete examples)",
      "uitleggen en verbinden (elaboration)",
    ]) {
      expect(p, name).toContain(name);
    }
    for (const level of ["afwezig (0)", "laag (1)", "middel (2)", "hoog (3)"]) {
      expect(p).toContain(level);
    }
    expect(p).toContain("reken geen totaal");
    expect(p).toContain("staat het niet in de opdracht");
    expect(p).toContain("dit is een concept. de docent kent de opdracht en de groep.");
  });

  it("guards the rubric and the honest-scoring rules (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    for (const h of ["**score per principle**", "**how to make it more active**"]) {
      expect(p, h).toContain(h);
    }
    for (const level of ["absent (0)", "low (1)", "medium (2)", "high (3)"]) {
      expect(p).toContain(level);
    }
    expect(p).toContain("do not compute a total");
    expect(p).toContain("this is a draft. the teacher knows the assignment and the group.");
  });
});
