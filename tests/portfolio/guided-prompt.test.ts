import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";
import { DRAFT_PROMPT_ID, QUESTIONS_PROMPT_ID } from "~/lib/portfolio/guided";

const headings = (s: string) => s.split("\n").filter((l) => l.startsWith("## ")).length;

describe("portfolio-questions@v2 prompt (guided writing, BDB step 6)", () => {
  const p = getPrompt(QUESTIONS_PROMPT_ID);

  it("is registered with both languages, Voice & Bounds, no placeholders and the JSON contract", () => {
    expect(QUESTIONS_PROMPT_ID).toBe("portfolio-questions@v2");
    expect(getPrompt("portfolio-questions@v1").id).toBe("portfolio-questions@v1");
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("Voice & Bounds");
      expect(p.runtime[lang]).not.toMatch(/\{\{/);
      expect(p.runtime[lang]).toContain('"questions"');
    }
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("asks two to four open questions about the teacher's own practice, and answers nothing itself", () => {
    expect(p.runtime.nl).toMatch(/twee tot vier/i);
    expect(p.runtime.nl).toMatch(/eigen praktijk/i);
    expect(p.runtime.nl).toMatch(/geen ja\/nee/i);
    expect(p.runtime.en).toMatch(/two to four/i);
    expect(p.runtime.en).toMatch(/own practice/i);
    expect(p.runtime.en).toMatch(/no yes\/no/i);
  });

  it("treats the teacher's material as data", () => {
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
  });

  it("does not ask for what the course already says", () => {
    for (const lang of ["nl", "en"] as const) expect(p.runtime[lang]).toContain("<course>");
    expect(p.runtime.nl).toMatch(/vraag niet naar wat in `<course>` staat/i);
    expect(p.runtime.en).toMatch(/do not ask for what `<course>` says/i);
  });
});

describe("portfolio-draft@v3 prompt (a paragraph per section from the answers)", () => {
  const p = getPrompt(DRAFT_PROMPT_ID);

  it("is the next version of the paragraph prompt; @v1 stays registered", () => {
    expect(DRAFT_PROMPT_ID).toBe("portfolio-draft@v3");
    expect(getPrompt("portfolio-draft@v1").id).toBe("portfolio-draft@v1");
    expect(getPrompt("portfolio-draft@v2").id).toBe("portfolio-draft@v2");
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("Voice & Bounds");
      expect(p.runtime[lang]).not.toMatch(/\{\{/);
      expect(p.runtime[lang]).toContain("<answers>");
    }
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("writes only from the answers and the evidence, and marks what is missing", () => {
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.nl).toContain("[aanvullen: …]");
    expect(p.runtime.en).toMatch(/invent nothing/i);
    expect(p.runtime.en).toContain("[to add: …]");
  });

  it("names no author outside the reference list at all, not even one the teacher mentions", () => {
    // Eval 2026-11-11a: the paragraph cited a source the teacher named but did not list.
    expect(p.runtime.nl).toMatch(/ook niet als de docent hem noemt/i);
    expect(p.runtime.en).toMatch(/even if the teacher mentions it/i);
  });

  it("uses the course's facts as the teacher's own, so they need no open spot", () => {
    for (const lang of ["nl", "en"] as const) expect(p.runtime[lang]).toContain("<course>");
    expect(p.runtime.nl).toMatch(/feiten uit `<course>`/i);
    expect(p.runtime.en).toMatch(/facts from `<course>`/i);
  });
});
