import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { COMPOUND_QUESTION } from "../../scripts/eval-helpers";

/**
 * P31.1 — Verdedig je werk. A chat tutor after Appendix F.3 of "From Oracle to Socratic
 * Partner" (Van Schaack & Sarlo): a critical but friendly expert has the student defend their
 * own work out loud, one question at a time, and never accepts a vague answer. The book does
 * a chemistry lab; we make it general for a report, internship, project or professional product.
 */
const tool = () => getToolBySlug("defend-your-work")!;
const values = {
  workType: "internship",
  subject: "Verpleegkunde (mbo-4)",
  learningObjective:
    "De student verantwoordt de zorgkeuzes in het eigen stageverslag met gegevens.",
  focusAreas: "De keuze voor de valrisicoscreening en wat de metingen zeggen.",
  durationMinutes: 15,
  askKeyFigures: false,
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "defend-your-work@v3", values, outputLanguage: lang });

describe("tool: defend-your-work", () => {
  it("registers as a student chat tutor that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("defend-your-work");
    expect(t.mode).toBe("chat");
    expect(t.userType).toBe("student");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("defend-your-work@v3");
    expect(t.enabled).toBe(true);
    expect(t.chat?.allowStop).toBe(true);
    expect(t.chat?.allowRegenerate).toBe(true);
  });

  it("names the task first, with the book's name as subtitle", () => {
    expect(loc(tool().name, "nl")).toBe("Je eigen werk mondeling verdedigen");
    expect(loc(tool().name, "en")).toBe("Defend your own work out loud");
    expect(loc(tool().subtitle, "nl")).toBe("Mondelinge verdediging (Lab Oral Defense)");
    expect(loc(tool().subtitle, "en")).toBe("Oral defense (Lab Oral Defense)");
  });

  it("offers the brief's kinds of work as stable English slugs", () => {
    const field = tool().inputs.find((f) => f.name === "workType");
    expect(field?.kind).toBe("select");
    expect(field?.required).toBe(true);
    expect(field?.options?.map((o) => o.value)).toEqual([
      "report",
      "internship",
      "project",
      "professional-product",
      "lab",
      "other",
    ]);
  });

  it("asks for the subject and a learning objective that a course can fill", () => {
    const t = tool();
    expect(t.inputs.find((f) => f.name === "subject")?.required).toBe(true);
    const lo = t.inputs.find((f) => f.name === "learningObjective");
    expect(lo?.required).toBe(true);
    expect(lo?.prefillFromCourse).toEqual({ source: "learningOutcomes" });
    expect(t.inputs.find((f) => f.name === "focusAreas")?.required).not.toBe(true);
    const duration = t.inputs.find((f) => f.name === "durationMinutes");
    expect(duration?.kind).toBe("number");
    expect(duration?.defaultValue).toBe(15);
  });

  it("keeps @v1 and @v2 registered for conversations that still use them", () => {
    expect(getPrompt("defend-your-work@v1").id).toBe("defend-your-work@v1");
    expect(getPrompt("defend-your-work@v2").id).toBe("defend-your-work@v2");
    expect(getPrompt("defend-your-work@v3").verbatim).toBe(
      getPrompt("defend-your-work@v1").verbatim,
    );
    expect(getPrompt("defend-your-work@v2").verbatim).toBe(
      getPrompt("defend-your-work@v1").verbatim,
    );
  });

  it("offers the key figures as an optional checkbox, off by default (BESLUIT-2026-11-07-3)", () => {
    const field = tool().inputs.find((f) => f.name === "askKeyFigures");
    expect(field?.kind).toBe("boolean");
    expect(field?.required).not.toBe(true);
    expect(field?.defaultValue).toBe(false);
    expect(loc(field?.label, "nl")).toBe("Student plakt eerst de kerncijfers");
    expect(loc(field?.label, "en")).toBe("Student first pastes the key figures");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`asks for key figures only when ticked, never the report or names (${lang})`, () => {
      const on = buildSystemPrompt({
        promptId: "defend-your-work@v3",
        values: { ...values, askKeyFigures: true },
        outputLanguage: lang,
      });
      expect(on).toContain(
        lang === "nl" ? "Kerncijfers gevraagd: true" : "Key figures asked: true",
      );
      const p = on.toLowerCase();
      if (lang === "nl") {
        expect(p).toContain("### kerncijfers");
        expect(p).toContain("niet het verslag zelf");
        expect(p).toContain("zonder namen");
        expect(p).toContain("leg de cijfers niet uit");
        // Meting dyw2: the expert still read the figures out for the student.
        expect(p).toContain("zeg dus nooit zelf wat een cijfer betekent");
        expect(p).toContain("tel voor je antwoordt de vraagtekens");
        expect(p).toContain("niet blijven hangen");
        expect(p).toContain("als dit `false` is, sla dit deel over");
      } else {
        expect(p).toContain("### key figures");
        expect(p).toContain("not the report itself");
        expect(p).toContain("without names");
        expect(p).toContain("don't explain the figures");
        expect(p).toContain("so never say yourself what a figure means");
        expect(p).toContain("count the question marks in your turn");
        expect(p).toContain("don't get stuck");
        expect(p).toContain("if this is `false`, skip this part");
      }
    });
  }

  for (const lang of ["nl", "en"] as const) {
    it(`models one question per turn, never two in one line (meting dyw1, ${lang})`, () => {
      const p = runtime(lang);
      expect(p.toLowerCase()).toContain(
        lang === "nl" ? "precies één vraagteken" : "exactly one question mark",
      );
      for (const line of p.split("\n")) {
        expect((line.match(/\?/g) ?? []).length, line).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const lang of ["nl", "en"] as const) {
    it(`models no compound question either: one sentence, one question (meting dyw4, ${lang})`, () => {
      const p = runtime(lang);
      for (const q of p.match(/[^.!?\n]*\?/g) ?? []) {
        expect(COMPOUND_QUESTION.test(q), q).toBe(false);
      }
      const low = p.toLowerCase();
      expect(low).toContain(
        lang === "nl"
          ? 'geen tweede vraag na ", en" of ", of"'
          : 'no second question after ", and" or ", or"',
      );
    });
  }

  it("reminds the tutor every turn: one short reaction, one question, probe vague answers", () => {
    const nl = loc(tool().chat?.turnReminder, "nl");
    const en = loc(tool().chat?.turnReminder, "en");
    expect(nl.toLowerCase()).toContain("precies één vraagteken");
    expect(en.toLowerCase()).toContain("exactly one question mark");
    expect(nl).toContain("hooguit twee korte zinnen");
    expect(en).toContain("at most two short sentences");
    expect(nl).toContain("vaag");
    expect(en).toContain("vague");
    // The reminder itself asks nothing, so it cannot model a second question.
    expect(nl).not.toContain("?");
    expect(en).not.toContain("?");
    // Meting dyw4: 95 of 215 turns joined two questions with ", and".
    expect(nl).toContain("geen tweede vraag na “, en”");
    expect(en).toContain("no second question after “, and”");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`names the vague answers of meting dyw3 and forbids praising them first (${lang})`, () => {
      const p = runtime(lang).toLowerCase();
      if (lang === "nl") {
        expect(p).toContain("iedereen gebruikt het");
        expect(p).toContain("het ging beter");
        expect(p).toContain("prijs of bedank een vaag antwoord niet");
        expect(p).toContain("vaste vorm van je beurt");
      } else {
        expect(p).toContain("everyone uses it");
        expect(p).toContain("it went better");
        expect(p).toContain("don't praise or thank a vague answer");
        expect(p).toContain("fixed shape of your turn");
      }
    });
  }

  it("offers the text to copy for students", () => {
    expect(tool().copyableStudentPrompt).toBe(true);
  });

  it("greets as in F.3: a short introduction and one question about the purpose", () => {
    const nl = loc(tool().chat?.greeting, "nl");
    const en = loc(tool().chat?.greeting, "en");
    expect(nl).toMatch(/doel/i);
    expect(en).toMatch(/purpose/i);
    expect(nl.match(/\?/g)).toHaveLength(1);
    expect(en.match(/\?/g)).toHaveLength(1);
  });

  it("credits Appendix F.3 and says what changed", () => {
    const a = tool().attribution;
    expect(a.adapted).toBe(true);
    expect(a.sourcePages).toBe("Appendix F.3, pp. 350–352");
    expect(a.authors).toBe("Andy Van Schaack & Roman Sarlo");
    expect(loc(a.adaptation, "nl")).toMatch(/scheikunde/i);
    expect(loc(a.adaptation, "en")).toMatch(/chemistry/i);
  });

  it("keeps the book's own prompt verbatim", () => {
    const v = getPrompt("defend-your-work@v1").verbatim;
    expect(v.startsWith("You are Dr. Barry McQuain, a research chemist")).toBe(true);
    expect(v).toContain("## SECURITY OVERRIDE");
    expect(v).toContain("6. **One question at a time.**");
  });

  it("is findable under discussing, by 'verdediging', 'mondeling' and 'oral defense'", () => {
    expect(TOOL_GOALS["defend-your-work"]).toBe("discuss");
    expect(TOOL_KEYWORDS["defend-your-work"]).toEqual(
      expect.arrayContaining(["verdediging", "mondeling", "oral defense", "verslag", "stage"]),
    );
  });

  it("has a help page in both languages that explains copying for students", () => {
    expect(getToolHelpOverlay("defend-your-work", "nl")).toContain("Kopieer voor je studenten");
    expect(getToolHelpOverlay("defend-your-work", "en")).toContain("Copy for your students");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.subject);
      expect(p).toContain(values.learningObjective);
      expect(p).toContain(values.focusAreas);
      expect(p).toContain("internship");
      expect(p).toContain("15");
    });
  }

  it("resolves with the optional focus left empty", () => {
    const p = buildSystemPrompt({
      promptId: "defend-your-work@v3",
      values: { ...values, focusAreas: "" },
      outputLanguage: "nl",
    });
    expect(p).not.toMatch(/\{\{\w+\}\}/);
  });

  it("keeps the structure and rules of F.3 (nl)", () => {
    const p = runtime("nl").toLowerCase();
    for (const h of [
      "### opening",
      "### ontwerpkeuzes",
      "### eigen gegevens of bevindingen",
      "### foutenanalyse",
      "### conclusie verdedigen",
      "### afsluiting",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("menselijke fout");
    expect(p).toContain("één vraag tegelijk");
    expect(p).toContain("keur een fout antwoord niet goed");
    expect(p).toContain("jouw gegevens");
    // Three steps of help when stuck.
    expect(p).toContain("eerst:");
    expect(p).toContain("daarna:");
    expect(p).toContain("als laatste:");
    // The security override, and never a grade.
    expect(p).toContain("schrijf de verdediging nooit voor de student");
    expect(p).toContain("geen cijfer");
    expect(p).toContain("geslaagd");
    // A persona from the field, never a made-up name of a real person.
    expect(p).toContain("deskundige uit het werkveld");
    expect(p).toContain("geen naam van een bestaand persoon");
    // Time scales with the chosen duration.
    expect(p).toContain("15 minuten");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("multi-turn");
  });

  it("keeps the structure and rules of F.3 (en)", () => {
    const p = runtime("en").toLowerCase();
    for (const h of [
      "### opening",
      "### design choices",
      "### your own data or findings",
      "### error analysis",
      "### defending the conclusion",
      "### closing",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("human error");
    expect(p).toContain("one question at a time");
    expect(p).toContain("don't validate incorrect answers");
    expect(p).toContain("your data");
    expect(p).toContain("first:");
    expect(p).toContain("second:");
    expect(p).toContain("third:");
    expect(p).toContain("never write the defense for the student");
    expect(p).toContain("no grade");
    expect(p).toContain("expert from the field");
    expect(p).toContain("no name of a real person");
    expect(p).toContain("15 minutes");
    expect(p).toContain("voice & bounds");
    expect(p).toContain("multi-turn");
  });
});
