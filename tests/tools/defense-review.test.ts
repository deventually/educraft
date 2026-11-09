import { describe, expect, it } from "vitest";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P31.2 — Een verdediging nakijken. After Appendix F.4 of "From Oracle to Socratic Partner"
 * (Van Schaack & Sarlo): the teacher pastes the transcript of a student's oral defense and gets
 * a draft analysis: content mastery on four levels, learner attributes, feedback for the student
 * and notes for the teacher. Student work, so anonymising is mandatory (BESLUIT-2026-11-07-2).
 */
const tool = () => getToolBySlug("defense-review")!;
const values = {
  transcript:
    "[AI] Wat was het doel van je werk?\n[Student] Minder valincidenten op de afdeling van [BEDRIJF].",
  workType: "internship",
  subject: "Verpleegkunde (mbo-4)",
  learningObjective:
    "De student verantwoordt de zorgkeuzes in het eigen stageverslag met gegevens.",
  masteryCriteria: "",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "defense-review@v1", values, outputLanguage: lang });

describe("tool: defense-review", () => {
  it("registers as a one-shot grading assistant for the teacher", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("defense-review");
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.stages[0]?.systemPromptId).toBe("defense-review@v1");
    expect(t.enabled).toBe(true);
  });

  it("is student work: assistive grading, never shared (BESLUIT-2026-11-07-2)", () => {
    expect(tool().handlesStudentWork).toBe(true);
    expect(tool().assistiveGrading).toBe(true);
  });

  it("makes anonymising the transcript mandatory", () => {
    const field = tool().inputs.find((f) => f.name === "transcript");
    expect(field?.required).toBe(true);
    expect(field?.redact).toBe(true);
    expect(loc(field?.help, "nl")).toContain("[AI]");
    expect(loc(field?.help, "nl")).toContain("[Student]");
    expect(loc(field?.help, "en")).toContain("[Student]");
  });

  it("names the task first, with the book's name as subtitle", () => {
    expect(loc(tool().name, "nl")).toBe("Een mondelinge verdediging nakijken");
    expect(loc(tool().name, "en")).toBe("Review an oral defense");
    expect(loc(tool().subtitle, "nl")).toBe("Transcriptanalyse (Lab Oral Defense)");
    expect(loc(tool().subtitle, "en")).toBe("Transcript analysis (Lab Oral Defense)");
  });

  it("shares the kinds of work with the defense tutor", () => {
    const own = tool().inputs.find((f) => f.name === "workType");
    const tutor = getToolBySlug("defend-your-work")!.inputs.find((f) => f.name === "workType");
    expect(own?.options).toEqual(tutor?.options);
    expect(own?.required).toBe(true);
  });

  it("asks for subject and learning objective; own criteria are optional", () => {
    const t = tool();
    expect(t.inputs.find((f) => f.name === "subject")?.required).toBe(true);
    const lo = t.inputs.find((f) => f.name === "learningObjective");
    expect(lo?.required).toBe(true);
    expect(lo?.prefillFromCourse).toEqual({ source: "learningOutcomes" });
    expect(t.inputs.find((f) => f.name === "masteryCriteria")?.required).not.toBe(true);
  });

  it("is the next step after the defense tutor", () => {
    expect(getToolBySlug("defend-your-work")!.next).toEqual(["defense-review"]);
  });

  it("credits Appendix F.4 and says what changed", () => {
    const a = tool().attribution;
    expect(a.adapted).toBe(true);
    expect(a.sourcePages).toBe("Appendix F.4, pp. 352–353");
    expect(a.authors).toBe("Andy Van Schaack & Roman Sarlo");
    expect(loc(a.adaptation, "nl")).toMatch(/scheikunde/i);
    expect(loc(a.adaptation, "nl")).toMatch(/anonim/i);
    expect(loc(a.adaptation, "en")).toMatch(/chemistry/i);
  });

  it("keeps the book's own prompt verbatim", () => {
    const v = getPrompt("defense-review@v1").verbatim;
    expect(v.startsWith("You are a Transcript Analyst evaluating a student’s oral defense")).toBe(
      true,
    );
    expect(v).toContain("## LEARNER ATTRIBUTE FRAMEWORK");
    expect(v).toContain("Messages from the AI are labeled [AI]");
  });

  it("is findable under assessing, by 'verdediging', 'nakijken' and 'transcript'", () => {
    expect(TOOL_GOALS["defense-review"]).toBe("assess");
    expect(TOOL_KEYWORDS["defense-review"]).toEqual(
      expect.arrayContaining(["verdediging", "nakijken", "transcript", "oral defense"]),
    );
  });

  it("has a help page in both languages that explains anonymising", () => {
    expect(getToolHelpOverlay("defense-review", "nl")).toContain("anonimiseren");
    expect(getToolHelpOverlay("defense-review", "en")).toContain("anonymis");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.subject);
      expect(p).toContain(values.learningObjective);
      expect(p).toContain("[BEDRIJF]");
      expect(p).toContain("internship");
    });
  }

  it("keeps the structure and rules of F.4 (nl)", () => {
    const p = runtime("nl").toLowerCase();
    for (const h of [
      "**inhoudelijk begrip**",
      "**leerhoudingen**",
      "**feedback voor de student**",
      "**notities voor de docent**",
    ]) {
      expect(p, h).toContain(h);
    }
    for (const level of ["uitstekend", "op niveau", "in ontwikkeling", "beginnend"]) {
      expect(p, level).toContain(level);
    }
    for (const attr of [
      "nieuwsgierigheid",
      "nauwkeurigheid",
      "eerlijkheid",
      "doorzetten",
      "eigenaarschap",
      "kritisch",
    ]) {
      expect(p, attr).toContain(attr);
    }
    expect(p).toContain("alleen als er duidelijk bewijs is");
    // Meting dr1: "Uitstekend (concept)" is not one of the four levels.
    expect(p).toContain("precies één van de vier niveaus, zonder toevoeging");
    expect(p).toContain("[ai]");
    expect(p).toContain("[student]");
    // What the AI said is never the student's understanding.
    expect(p).toContain("telt niet als begrip van de student");
    // Codes from the anonymise step; never guess who is behind them.
    expect(p).toContain("raad niet wie er achter een code zit");
    // Advice for the teacher, who decides; never a grade.
    expect(p).toContain("de docent beslist");
    expect(p).toContain("geen cijfer");
    expect(p).toContain("voice & bounds");
  });

  it("keeps the structure and rules of F.4 (en)", () => {
    const p = runtime("en").toLowerCase();
    for (const h of [
      "**content mastery**",
      "**learner attributes**",
      "**feedback for the student**",
      "**notes for the teacher**",
    ]) {
      expect(p, h).toContain(h);
    }
    for (const level of ["exemplary", "proficient", "developing", "beginning"]) {
      expect(p, level).toContain(level);
    }
    for (const attr of [
      "curiosity",
      "rigor",
      "integrity",
      "perseverance",
      "ownership",
      "skepticism",
    ]) {
      expect(p, attr).toContain(attr);
    }
    expect(p).toContain("only when there is clear evidence");
    expect(p).toContain("exactly one of the four levels, with nothing added");
    expect(p).toContain("does not count as the student's understanding");
    expect(p).toContain("don't guess who is behind a code");
    expect(p).toContain("the teacher decides");
    expect(p).toContain("no grade");
    expect(p).toContain("voice & bounds");
  });
});
