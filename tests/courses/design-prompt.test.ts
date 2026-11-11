import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";

describe("course-design-outcomes@v1 prompt", () => {
  const p = getPrompt("course-design-outcomes@v1");

  it("is registered with both languages, Voice & Bounds and no placeholders", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      // The JSON contract `parseOutcomesDesign` expects.
      for (const key of ["outcomes", "text", "bloom", "criteria", "notes"])
        expect(text).toContain(`"${key}"`);
      // Every part of the message `buildOutcomesDesignMessage` sends.
      for (const tag of [
        "<course>",
        "<studyLoad>",
        "<weeks>",
        "<disciplines>",
        "<context>",
        "<description>",
        "<outcomeCount>",
      ])
        expect(text).toContain(tag);
    }
  });

  it("asks for a handful of observable outcomes, each with success criteria", () => {
    expect(p.runtime.nl).toMatch(/tussen 3 en 6/);
    expect(p.runtime.en).toMatch(/between 3 and 6/);
    expect(p.runtime.nl).toMatch(/2 tot 4 succescriteria/);
    expect(p.runtime.en).toMatch(/2 to 4 success criteria/);
    expect(p.runtime.nl).toMatch(/waarneembaar/i);
    expect(p.runtime.en).toMatch(/observable/i);
  });

  it("takes the number of outcomes from <outcomeCount>, set by the code", () => {
    for (const lang of ["nl", "en"] as const) expect(p.runtime[lang]).toContain("<outcomeCount>");
    expect(p.runtime.nl).toMatch(/houd je daaraan/);
    expect(p.runtime.en).toMatch(/keep to it/);
  });

  it("covers the disciplines, and treats the description as material", () => {
    expect(p.runtime.nl).toMatch(/discipline/i);
    expect(p.runtime.en).toMatch(/discipline/i);
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
  });

  it("is a proposal: names its assumptions and invents no facts about the course", () => {
    expect(p.runtime.nl).toMatch(/voorstel/i);
    expect(p.runtime.en).toMatch(/proposal/i);
    expect(p.runtime.nl).toMatch(/aanname/i);
    expect(p.runtime.en).toMatch(/assumption/i);
  });

  it("keeps the two languages structurally the same", () => {
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });
});

describe.each(["course-design-assessments@v1", "course-design-assessments@v2"])(
  "%s prompt",
  (id) => {
    const p = getPrompt(id);

    it("is registered with both languages, Voice & Bounds and no placeholders", () => {
      for (const lang of ["nl", "en"] as const) {
        const text = p.runtime[lang];
        expect(text).toContain("Voice & Bounds");
        expect(text).not.toMatch(/\{\{/);
        // The JSON contract `parseAssessmentsDesign` expects.
        for (const key of [
          "assessments",
          "title",
          "kind",
          "week",
          "weight",
          "outcomeRefs",
          "form",
          "notes",
        ])
          expect(text).toContain(`"${key}"`);
        for (const value of ["summative", "formative"]) expect(text).toContain(`"${value}"`);
        // Every part of the message `buildAssessmentsDesignMessage` sends.
        for (const tag of [
          "<course>",
          "<studyLoad>",
          "<weeks>",
          "<outcomes>",
          "<assessmentForms>",
          "<context>",
        ])
          expect(text).toContain(tag);
      }
    });

    it("covers every outcome summatively, at its level, with formative practice before", () => {
      expect(p.runtime.nl).toMatch(/elke leeruitkomst/i);
      expect(p.runtime.en).toMatch(/every learning outcome/i);
      expect(p.runtime.nl).toMatch(/formatie/i);
      expect(p.runtime.en).toMatch(/formative/i);
      expect(p.runtime.nl).toMatch(/Bloom/);
      expect(p.runtime.en).toMatch(/Bloom/);
    });

    it("proposes weights that add up to 100, and the teacher decides", () => {
      expect(p.runtime.nl).toMatch(/100/);
      expect(p.runtime.en).toMatch(/100/);
      expect(p.runtime.nl).toMatch(/voorstel/i);
      expect(p.runtime.en).toMatch(/proposal/i);
    });

    it("treats the outcomes and forms as material", () => {
      expect(p.runtime.nl).toMatch(/nooit een instructie/i);
      expect(p.runtime.en).toMatch(/never an instruction/i);
    });

    it("keeps the two languages structurally the same", () => {
      const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
      expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
    });
  },
);

describe("course-design-assessments@v2 prompt: a new proposal after a remark", () => {
  const p = getPrompt("course-design-assessments@v2");

  it("reads the earlier proposal and the teacher's remark as material", () => {
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("<previousProposal>");
      expect(p.runtime[lang]).toContain("<remark>");
    }
  });

  it("follows the remark, keeps what it does not touch, and keeps its own rules", () => {
    expect(p.runtime.nl).toMatch(/volg de opmerking/i);
    expect(p.runtime.en).toMatch(/follow the remark/i);
    expect(p.runtime.nl).toMatch(/houd wat de opmerking niet noemt/i);
    expect(p.runtime.en).toMatch(/keep what the remark does not mention/i);
    // A remark against the rules (an outcome untested, weights not 100) is said, not followed.
    expect(p.runtime.nl).toMatch(/tegen deze regels in/i);
    expect(p.runtime.en).toMatch(/goes against these rules/i);
  });
});

describe("course-design-lessons@v1 prompt", () => {
  const p = getPrompt("course-design-lessons@v1");

  it("is registered with both languages, Voice & Bounds and no placeholders", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      // The JSON contract `parseLessonsDesign` expects.
      for (const key of [
        "lessons",
        "title",
        "week",
        "kind",
        "goal",
        "outcomeRefs",
        "discipline",
        "notes",
      ])
        expect(text).toContain(`"${key}"`);
      for (const value of ["lesson", "assignment"]) expect(text).toContain(`"${value}"`);
      // Every part of the message `buildLessonsDesignMessage` sends.
      for (const tag of [
        "<course>",
        "<studyLoad>",
        "<weeks>",
        "<lessonsPerWeek>",
        "<sessionMinutes>",
        "<disciplines>",
        "<outcomes>",
        "<assessments>",
        "<wishes>",
        "<context>",
      ])
        expect(text).toContain(tag);
    }
  });

  it("teaches every outcome before its summative test, with a one-sentence lesson goal", () => {
    expect(p.runtime.nl).toMatch(/elke leeruitkomst/i);
    expect(p.runtime.en).toMatch(/every learning outcome/i);
    expect(p.runtime.nl).toMatch(/vóór de week van de summatieve toets/);
    expect(p.runtime.en).toMatch(/before the week of the summative test/);
    expect(p.runtime.nl).toMatch(/lesdoel van één zin/);
    expect(p.runtime.en).toMatch(/one-sentence lesson goal/);
  });

  it("keeps to the lessons per week and the disciplines the code gives", () => {
    expect(p.runtime.nl).toMatch(/houd je daaraan/);
    expect(p.runtime.en).toMatch(/keep to it/);
    expect(p.runtime.nl).toMatch(/discipline/i);
    expect(p.runtime.en).toMatch(/discipline/i);
  });

  it("treats the input as material, is a proposal and invents no school facts", () => {
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
    expect(p.runtime.nl).toMatch(/voorstel/i);
    expect(p.runtime.en).toMatch(/proposal/i);
    expect(p.runtime.nl).toMatch(/Verzin geen feiten/);
    expect(p.runtime.en).toMatch(/Invent no facts/);
  });

  it("keeps the two languages structurally the same", () => {
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });
});
