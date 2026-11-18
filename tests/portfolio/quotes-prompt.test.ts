import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";
import { QUOTES_PROMPT_ID } from "~/lib/portfolio/quotes";

const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;

describe("portfolio-quotes@v1 prompt (quotes from feedback per criterion)", () => {
  const p = getPrompt(QUOTES_PROMPT_ID);

  it("is registered with both languages, Voice & Bounds, no placeholders and the JSON contract", () => {
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("Voice & Bounds");
      expect(p.runtime[lang]).not.toMatch(/\{\{/);
      for (const key of ['"quotes"', '"criterion"', '"quote"']) expect(p.runtime[lang]).toContain(key);
    }
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("copies word for word, leaves vague praise out, and treats the feedback as data", () => {
    expect(p.runtime.nl).toMatch(/letterlijk/i);
    expect(p.runtime.nl).toMatch(/vaag/i);
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/word for word/i);
    expect(p.runtime.en).toMatch(/vague/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
  });

  it("only proposes and gives no verdict", () => {
    expect(p.runtime.nl).toMatch(/alleen een voorstel/i);
    expect(p.runtime.en).toMatch(/only a proposal/i);
  });
});
