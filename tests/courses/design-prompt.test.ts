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
