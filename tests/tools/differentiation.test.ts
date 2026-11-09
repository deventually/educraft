import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.7 — Differentiëren. A one-shot instructor tool: a task or explanation in three
 * variants (extra support, the base, extra challenge) that all serve the same learning goal,
 * plus a short tip on how to use the variants in class. Source: Tomlinson, C. A. (2017),
 * How to Differentiate Instruction in Academically Diverse Classrooms, 3rd ed. (ASCD).
 */
const tool = () => getToolBySlug("differentiation")!;
const values = {
  learningGoal: "De student stelt bij een casus een verpleegkundige diagnose op volgens PES.",
  material:
    "Opdracht: lees de casus van meneer De Wit (78) en stel een verpleegkundige diagnose op.",
  groupInfo: "Een deel van de groep loopt al stage op een interne afdeling.",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "differentiation@v1", values, outputLanguage: lang });

describe("tool: differentiation", () => {
  it("registers as a one-shot, single-stage instructor tool that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("differentiation");
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("differentiation@v1");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Opdracht differentiëren");
    expect(loc(tool().name, "en")).toBe("Differentiate a task");
  });

  it("needs the goal and the material; what the teacher knows of the group is optional", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(field("learningGoal")?.required).toBe(true);
    expect(field("material")?.required).toBe(true);
    expect(field("groupInfo")?.required).not.toBe(true);
    expect(tool().inputs.map((f) => f.name)).toEqual(["learningGoal", "material", "groupInfo"]);
  });

  it("asks for no student names: the group is described, not listed", () => {
    for (const lang of ["nl", "en"] as const) {
      const help = loc(tool().inputs.find((f) => f.name === "groupInfo")?.help, lang);
      expect(help.toLowerCase()).toMatch(lang === "nl" ? /geen namen/ : /no names/);
    }
  });

  it("is an original LimeOnIt tool that names its verified source", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(["Tomlinson (2017)"]);
  });

  it("is findable under planning, by 'differentiëren', 'niveaus' and 'tomlinson'", () => {
    expect(TOOL_GOALS.differentiation).toBe("design");
    expect(TOOL_KEYWORDS.differentiation).toEqual(
      expect.arrayContaining([
        "differentiëren",
        "differentiatie",
        "differentiate",
        "niveaus",
        "tomlinson",
      ]),
    );
  });

  it("has room for three written-out variants", () => {
    expect(tool().defaultMaxTokens).toBeGreaterThanOrEqual(8192);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.learningGoal);
      expect(p).toContain(values.material);
    });
  }

  it("guards the brief's demands and Tomlinson's principles (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("tomlinson");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("verzin niets");
    // Brief 24.7: three variants with the same learning goal, and a tip for class.
    for (const h of [
      "**variant met extra steun**",
      "**basisvariant**",
      "**variant met extra uitdaging**",
      "**zo zet je de varianten in**",
      "**check op de varianten**",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("hetzelfde leerdoel");
    // Tomlinson: respectful tasks, teaching up, readiness, flexible grouping.
    expect(p).toContain("respectvol");
    expect(p).toContain("geen kleiner leerdoel");
    expect(p).toContain("niet meer werk");
    expect(p).toContain("flexibel");
    // Known errors the tool must catch.
    expect(p).toContain("niet waarneembaar");
    expect(p).toContain("past niet bij het leerdoel");
    expect(p).toContain("lager leerdoel");
    expect(p).toContain("genderneutraal");
    expect(p).toContain("dit is een concept. de docent kent de groep en past de varianten aan.");
  });

  it("guards the brief's demands and Tomlinson's principles (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("tomlinson");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("invent nothing");
    for (const h of [
      "**variant with extra support**",
      "**base variant**",
      "**variant with extra challenge**",
      "**how to use the variants**",
      "**check of the variants**",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("the same learning goal");
    expect(p).toContain("respectful");
    expect(p).toContain("no smaller learning goal");
    expect(p).toContain("not more work");
    expect(p).toContain("flexible");
    expect(p).toContain("not observable");
    expect(p).toContain("does not fit the learning goal");
    expect(p).toContain("lower learning goal");
    expect(p).toContain("gender-neutral");
    expect(p).toContain("this is a draft. the teacher knows the group and adapts the variants.");
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("differentiation@v1").verbatim).toMatch(/LimeOnIt/);
  });
});
