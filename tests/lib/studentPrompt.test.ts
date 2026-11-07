import { describe, expect, it } from "vitest";
import { fillStudentPrompt } from "~/lib/chat/studentPrompt";
import { studentPromptTemplates } from "~/lib/template/studentPromptTemplate";
import { ALL_TOOLS, getToolBySlug } from "~/lib/registry";
import type { ContextProfile } from "~/lib/context/types";

/**
 * P31.1 — "Kopieer voor je studenten". As in the book, the teacher copies the tutor's prompt and
 * the student pastes it into their own AI. The server builds the prompt once per language with
 * the form fields left as {{placeholders}} (the profile already filled in); the browser fills
 * those with what the teacher entered. Data on the tool (`copyableStudentPrompt`), no per-tool code.
 */
const tool = () => getToolBySlug("defend-your-work")!;

describe("the text a teacher copies for students", () => {
  it("is offered only by student tutors", () => {
    for (const t of ALL_TOOLS) {
      if (t.copyableStudentPrompt) {
        expect(t.userType, t.slug).toBe("student");
        expect(t.mode, t.slug).toBe("chat");
      }
    }
  });

  it("keeps the form fields as placeholders and leaves nothing else open", () => {
    const tpl = studentPromptTemplates(tool(), null);
    for (const lang of ["nl", "en"] as const) {
      expect(tpl[lang]).toContain("{{subject}}");
      expect(tpl[lang]).toContain("{{learningObjective}}");
      expect(tpl[lang]).not.toContain("{{contextProfile}}");
      expect(tpl[lang]).not.toContain("{{outputLanguage}}");
    }
  });

  it("fills the teacher's values in the browser, an empty optional field included", () => {
    const tpl = studentPromptTemplates(tool(), null);
    const text = fillStudentPrompt(tpl.nl, tool().inputs, {
      workType: "report",
      subject: "HBO-ICT",
      learningObjective: "De student verantwoordt de architectuurkeuzes.",
      focusAreas: "",
      durationMinutes: 20,
    });
    expect(text).not.toMatch(/\{\{\w+\}\}/);
    expect(text).toContain("HBO-ICT");
    expect(text).toContain("De student verantwoordt de architectuurkeuzes.");
    expect(text).toContain("20 minuten");
  });

  it("carries the teacher's context profile, in the learner register", () => {
    const profile: ContextProfile = {
      id: "p1",
      name: "Mijn opleiding",
      sector: "hbo",
      eqf: 6,
      programme: "Bedrijfskunde",
    };
    const tpl = studentPromptTemplates(tool(), profile);
    expect(tpl.nl).toContain("Bedrijfskunde");
    expect(tpl.nl).toContain("woordkeuze");
  });

  it("leaves no placeholder behind when a required value is missing", () => {
    const tpl = studentPromptTemplates(tool(), null);
    const text = fillStudentPrompt(tpl.en, tool().inputs, { workType: "lab" });
    expect(text).not.toMatch(/\{\{\w+\}\}/);
  });
});
