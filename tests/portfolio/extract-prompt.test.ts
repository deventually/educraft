import { describe, it, expect } from "vitest";
import { getPrompt } from "~/lib/prompts";

describe("portfolio-framework@v1 prompt", () => {
  const p = getPrompt("portfolio-framework@v1");

  it("is registered with both languages, Voice & Bounds and no placeholders", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = p.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      // The JSON contract the parser expects.
      for (const key of ["outcomes", "criteria", "strongLevel", "requiredEvidence", "requirements"])
        expect(text).toContain(`"${key}"`);
    }
  });

  it("tells the model to copy criteria literally, invent nothing and note doubt", () => {
    expect(p.runtime.nl).toMatch(/letterlijk/i);
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.en).toMatch(/verbatim/i);
    expect(p.runtime.en).toMatch(/invent nothing/i);
    for (const lang of ["nl", "en"] as const) expect(p.runtime[lang]).toContain("`notes`");
  });

  it("keeps only mandatory evidence, with its condition, and leaves suggestions out", () => {
    expect(p.runtime.nl).toMatch(/voorwaarde/i);
    expect(p.runtime.nl).toMatch(/toetssuggestie/i);
    expect(p.runtime.en).toMatch(/condition/i);
    expect(p.runtime.en).toMatch(/suggest/i);
  });

  it("keeps the two languages structurally the same", () => {
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });
});
