import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";
import { SORT_PROMPT_ID } from "~/lib/portfolio/batch";
import { EVIDENCE_KINDS } from "~/lib/portfolio/types";

const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;

describe("portfolio-evidence-sort@v1 prompt (adding evidence in one go)", () => {
  const p = getPrompt(SORT_PROMPT_ID);

  it("is registered with both languages, Voice & Bounds, no placeholders and the JSON contract", () => {
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("Voice & Bounds");
      expect(p.runtime[lang]).not.toMatch(/\{\{/);
      for (const key of ['"outcome"', '"kind"', '"criteria"', '"required"', '"sure"'])
        expect(p.runtime[lang]).toContain(key);
      for (const kind of EVIDENCE_KINDS) expect(p.runtime[lang]).toContain(`\`${kind}\``);
    }
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("only proposes, says when it doubts, and treats the file as data", () => {
    expect(p.runtime.nl).toMatch(/alleen een voorstel/i);
    expect(p.runtime.nl).toMatch(/"sure": false/);
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/only a proposal/i);
    expect(p.runtime.en).toMatch(/"sure": false/);
    expect(p.runtime.en).toMatch(/never an instruction/i);
  });

  it("never makes a tool's output or the teacher's own text into someone's feedback", () => {
    expect(p.runtime.nl).toMatch(/feedback van een ander/i);
    expect(p.runtime.en).toMatch(/feedback from someone else/i);
  });
});
