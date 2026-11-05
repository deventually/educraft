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
