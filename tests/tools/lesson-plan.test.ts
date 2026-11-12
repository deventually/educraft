import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.4 — Les voorbereiden. A one-shot instructor tool: from a learning goal, the content,
 * the lesson length, group size and delivery mode, a draft lesson plan with a time plan that
 * adds up to the lesson length, in which every phase serves the goal. The phases follow the
 * ten principles in Rosenshine (2012), Principles of Instruction, American Educator 36(1).
 */
const tool = () => getToolBySlug("lesson-plan")!;
const values = {
  learningGoal:
    "De student berekent met de formule van Gordon de intrinsieke waarde van een aandeel.",
  content: "Het dividendgroeimodel van Gordon, met twee rekenvoorbeelden.",
  priorKnowledge: "Contante waarde en rendement zijn vorige week behandeld.",
  duration: "90",
  groupSize: "28",
  deliveryMode: "in-person",
  constraints: "",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "lesson-plan@v2", values, outputLanguage: lang });

describe("tool: lesson-plan", () => {
  it("registers as a one-shot, single-stage instructor tool that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("lesson-plan");
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("lesson-plan@v2");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Les voorbereiden");
    expect(loc(tool().name, "en")).toBe("Prepare a lesson");
  });

  it("needs the goal, the content, the length, the group size and the delivery mode", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    for (const n of ["learningGoal", "content", "duration", "groupSize", "deliveryMode"]) {
      expect(field(n)?.required, n).toBe(true);
    }
    expect(field("priorKnowledge")?.required).not.toBe(true);
    expect(field("constraints")?.required).not.toBe(true);
    expect(field("duration")?.kind).toBe("number");
    expect(field("groupSize")?.kind).toBe("number");
    expect(field("deliveryMode")?.options?.map((o) => o.value)).toEqual([
      "in-person",
      "online",
      "hybrid",
    ]);
  });

  it("is an original LimeOnIt tool that names its verified source", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(["Rosenshine (2012)"]);
  });

  it("is findable under planning, by 'les', 'lesplan' and 'rosenshine'", () => {
    expect(TOOL_GOALS["lesson-plan"]).toBe("design");
    expect(TOOL_KEYWORDS["lesson-plan"]).toEqual(
      expect.arrayContaining(["les", "lesplan", "lesson plan", "tijdsplan", "rosenshine"]),
    );
  });

  it("has room for a whole lesson plan", () => {
    expect(tool().defaultMaxTokens).toBeGreaterThanOrEqual(8192);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.learningGoal);
      expect(p).toContain("90");
    });
  }

  it("guards the brief's demands and Rosenshine's principles (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("rosenshine");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("verzin niets");
    // Brief 24.4: the time plan adds up to the lesson length; every phase serves the goal.
    expect(p).toContain("telt op tot");
    expect(p).toContain("dient het leerdoel");
    // The phases from the brief.
    for (const phase of [
      "voorkennis ophalen",
      "uitleg in kleine stappen",
      "begeleide oefening",
      "check op begrip",
      "zelfstandige verwerking",
      "afsluiting",
    ]) {
      expect(p, phase).toContain(phase);
    }
    expect(p).toContain("80"); // Rosenshine's success rate of about 80 percent
    expect(p).toContain("alle studenten"); // check the responses of all students
    expect(p).toContain("groepsgrootte");
    expect(p).toContain("contactvorm");
    // Known errors the tool must catch.
    expect(p).toContain("past niet in"); // too much content for the time
    expect(p).toContain("voorkennis ontbreekt");
    expect(p).toContain("niet waarneembaar");
    expect(p).toContain("dit is een concept. de docent past de les aan op de eigen groep.");
    // Meting lp1: "hij" for students and teachers, minutes inside a phase that did not add
    // up to the phase, and a proposed break row the judge took for a format slip.
    expect(p).toContain("genderneutraal");
    expect(p).toContain("binnen een fase");
    expect(p).toContain("pauze (voorstel)");
    // Meting lp2: a table totalling 60 over 59 minutes, corrected below with a second table.
    expect(p).toContain("één tijdsplan, zonder correctie achteraf");
  });

  it("guards the brief's demands and Rosenshine's principles (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("rosenshine");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("invent nothing");
    expect(p).toContain("adds up to");
    expect(p).toContain("serves the learning goal");
    for (const phase of [
      "activating prior knowledge",
      "explanation in small steps",
      "guided practice",
      "check for understanding",
      "independent practice",
      "closing",
    ]) {
      expect(p, phase).toContain(phase);
    }
    expect(p).toContain("80");
    expect(p).toContain("all students");
    expect(p).toContain("group size");
    expect(p).toContain("delivery mode");
    expect(p).toContain("does not fit");
    expect(p).toContain("prior knowledge is missing");
    expect(p).toContain("not observable");
    expect(p).toContain("this is a draft. the teacher adapts the lesson to their own group.");
    expect(p).toContain("gender-neutral");
    expect(p).toContain("within a phase");
    expect(p).toContain("break (proposal)");
    expect(p).toContain("one time plan, with no correction afterwards");
  });

  it("asks for a time plan table with a total row, in both languages", () => {
    expect(runtime("nl")).toContain("| Fase | Minuten |");
    expect(runtime("nl")).toContain("| **Totaal** |");
    expect(runtime("en")).toContain("| Phase | Minutes |");
    expect(runtime("en")).toContain("| **Total** |");
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("lesson-plan@v1").verbatim).toMatch(/LimeOnIt/);
  });
});

/**
 * @v2: an expected answer never shares a list item with its question. The list items of a phase
 * become the points on a slide students see (P30.4); the answers go in their own paragraph,
 * which the deck puts in the speaker notes.
 */
describe("lesson-plan@v2: expected answers off the slides", () => {
  it("keeps @v1 registered for work that still uses it, with the same source text", () => {
    expect(getPrompt("lesson-plan@v1").id).toBe("lesson-plan@v1");
    expect(getPrompt("lesson-plan@v2").verbatim).toBe(getPrompt("lesson-plan@v1").verbatim);
  });

  it.each([
    ["nl", "Verwachte antwoorden:", "nooit in hetzelfde lijstpunt"],
    ["en", "Expected answers:", "never in the same list item"],
  ] as const)(
    "asks in %s for the answers in their own paragraph after the list",
    (lang, label, rule) => {
      const prompt = runtime(lang);
      expect(prompt).toContain(label);
      expect(prompt).toContain(rule);
      expect(prompt).not.toMatch(/\{\{\w+\}\}/);
    },
  );

  it("leaves @v1 as it was", () => {
    const v1 = buildSystemPrompt({ promptId: "lesson-plan@v1", values, outputLanguage: "nl" });
    expect(v1).not.toContain("Verwachte antwoorden:");
  });
});
