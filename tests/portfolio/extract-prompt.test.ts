import { describe, it, expect } from "vitest";
import { getPrompt } from "~/lib/prompts";
import { FRAMEWORK_PROMPT_ID } from "~/lib/portfolio/extract";

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

describe("portfolio-framework@v2 prompt (chapter outline)", () => {
  const v1 = getPrompt("portfolio-framework@v1");
  const v2 = getPrompt("portfolio-framework@v2");

  it("is what the extraction uses; v1 stays registered", () => {
    expect(FRAMEWORK_PROMPT_ID).toBe("portfolio-framework@v2");
    expect(v1.runtime.nl).toBeTruthy();
  });

  it("keeps everything v1 asks and adds the outline and literature contract", () => {
    for (const lang of ["nl", "en"] as const) {
      const text = v2.runtime[lang];
      expect(text).toContain("Voice & Bounds");
      expect(text).not.toMatch(/\{\{/);
      for (const key of [
        "outcomes",
        "criteria",
        "strongLevel",
        "requiredEvidence",
        "requirements",
        "outline",
        "title",
        "description",
        "literature",
      ])
        expect(text).toContain(`"${key}"`);
      expect(text).toContain("`notes`");
    }
    expect(v2.runtime.nl).toMatch(/letterlijk/i);
    expect(v2.runtime.nl).toMatch(/verzin niets/i);
    expect(v2.runtime.en).toMatch(/verbatim/i);
    expect(v2.runtime.en).toMatch(/invent nothing/i);
  });

  it("numbers the criteria for the sections and forbids inventing an outline or a source", () => {
    expect(v2.runtime.nl).toMatch(/nummer/i);
    expect(v2.runtime.en).toMatch(/number/i);
    expect(v2.runtime.nl).toMatch(/"outline": \[\]/);
    expect(v2.runtime.en).toMatch(/"outline": \[\]/);
    expect(v2.runtime.nl).toMatch(/bron/i);
    expect(v2.runtime.en).toMatch(/source/i);
  });

  it("keeps the two languages structurally the same", () => {
    const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;
    const bullets = (s: string) => s.split("\n").filter((l) => /^\s*- /.test(l)).length;
    expect(headings(v2.runtime.nl)).toBe(headings(v2.runtime.en));
    expect(bullets(v2.runtime.nl)).toBe(bullets(v2.runtime.en));
  });
});
