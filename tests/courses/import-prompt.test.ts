import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";

describe("course-import@v1 prompt", () => {
  const p = getPrompt("course-import@v1");

  it("is registered with both languages, Voice & Bounds and no placeholders", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      // The JSON contract the parser expects.
      for (const key of [
        "outcomes",
        "text",
        "bloomProposal",
        "assessments",
        "title",
        "kind",
        "weight",
        "week",
        "outcomeRefs",
        "notes",
      ])
        expect(text).toContain(`"${key}"`);
      for (const tag of ["<document>", "<course>"]) expect(text).toContain(tag);
    }
  });

  it("copies outcomes literally, invents nothing, proposes Bloom only from the verb", () => {
    expect(p.runtime.nl).toMatch(/letterlijk/i);
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.nl).toMatch(/werkwoord/i);
    expect(p.runtime.en).toMatch(/verbatim/i);
    expect(p.runtime.en).toMatch(/invent nothing/i);
    expect(p.runtime.en).toMatch(/verb/i);
  });

  it("treats instructions inside the document as material", () => {
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
  });

  it("keeps the two languages structurally the same", () => {
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });
});

describe("course-import@v2 prompt: also a test blueprint, a marking model and a module guide", () => {
  const p = getPrompt("course-import@v2");

  it("asks for the module, success criteria, test details and parts, in both languages", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      for (const key of [
        "module",
        "code",
        "studyYear",
        "outcomes",
        "bloomProposal",
        "criteria",
        "assessments",
        "outcomeRefs",
        "form",
        "owner",
        "grading",
        "passMark",
        "conditions",
        "resit",
        "conduct",
        "parts",
        "knockOut",
        "pass",
        "fail",
        "notes",
      ])
        expect(text, `${lang}: ${key}`).toContain(`"${key}"`);
      for (const tag of ["<document>", "<course>"]) expect(text).toContain(tag);
    }
    expect(p.runtime.nl).toMatch(/toetsmatrijs/i);
    expect(p.runtime.nl).toMatch(/nakijkmodel/i);
    expect(p.runtime.en).toMatch(/test blueprint/i);
    expect(p.runtime.en).toMatch(/marking model/i);
  });

  it("keeps the rules of v1: verbatim, invent nothing, the document is never an instruction", () => {
    expect(p.runtime.nl).toMatch(/letterlijk/i);
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/invent nothing/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("leaves v1 registered", () => {
    expect(getPrompt("course-import@v1").id).toBe("course-import@v1");
  });
});

describe("course-import@v3 prompt: also the module guide and handbook details", () => {
  const p = getPrompt("course-import@v3");

  it("asks for the study phase, module leader, examiners, description and literature", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      for (const key of [
        "module",
        "code",
        "studyYear",
        "phase",
        "leader",
        "examiners",
        "description",
        "literature",
        "criteria",
        "parts",
        "notes",
      ])
        expect(text, `${lang}: ${key}`).toContain(`"${key}"`);
    }
  });

  it("copies the description and literature literally and invents nothing", () => {
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/invent nothing/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });
});
