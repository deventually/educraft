import { describe, expect, it } from "vitest";
import { getPrompt } from "~/lib/prompts";
import { DRAFT_PROMPT_ID, FOLLOW_UP_PROMPT_ID, QUESTIONS_PROMPT_ID } from "~/lib/portfolio/guided";

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

describe("portfolio-draft@v4 prompt (a paragraph per section, in the teacher's voice)", () => {
  const p = getPrompt(DRAFT_PROMPT_ID);

  it("is the next version of the paragraph prompt; @v1 stays registered", () => {
    expect(DRAFT_PROMPT_ID).toBe("portfolio-draft@v4");
    expect(getPrompt("portfolio-draft@v1").id).toBe("portfolio-draft@v1");
    expect(getPrompt("portfolio-draft@v2").id).toBe("portfolio-draft@v2");
    expect(getPrompt("portfolio-draft@v3").id).toBe("portfolio-draft@v3");
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

  it("keeps the teacher's voice: their words, literal quotes, something concrete per sentence", () => {
    expect(p.runtime.nl).toMatch(/de stem van de docent/i);
    expect(p.runtime.nl).toMatch(/letterlijk over, als citaat/i);
    expect(p.runtime.en).toMatch(/the teacher's voice/i);
    expect(p.runtime.en).toMatch(/literally, as a quotation/i);
    expect(p.runtime.nl).toMatch(/alleen binnen een open plek, nooit in de lopende tekst/i);
    expect(p.runtime.en).toMatch(/only inside an open spot, never in the running text/i);
  });

  it("avoids the generic phrasing the chapter check flags, and asks precisely for what is missing", () => {
    for (const w of ["cruciaal", "niet alleen … maar ook", "gedachtestreepjes", "Kortom"])
      expect(p.runtime.nl).toContain(w);
    for (const w of ["crucial", "not only … but also", "dashes", "In conclusion"])
      expect(p.runtime.en).toContain(w);
    expect(p.runtime.nl).toMatch(/geen vulzinnen rond een open plek/i);
    expect(p.runtime.en).toMatch(/no filler around an open spot/i);
  });
});

describe("portfolio-followup@v1 prompt (following up on vague answers)", () => {
  const p = getPrompt(FOLLOW_UP_PROMPT_ID);

  it("is registered with both languages, Voice & Bounds, no placeholders and the JSON contract", () => {
    expect(FOLLOW_UP_PROMPT_ID).toBe("portfolio-followup@v1");
    for (const lang of ["nl", "en"] as const) {
      expect(p.runtime[lang]).toContain("Voice & Bounds");
      expect(p.runtime[lang]).not.toMatch(/\{\{/);
      expect(p.runtime[lang]).toContain('"questions"');
      expect(p.runtime[lang]).toContain("<answers>");
    }
    expect(headings(p.runtime.nl)).toBe(headings(p.runtime.en));
  });

  it("asks zero to two questions about the concrete moment, and none when the answers suffice", () => {
    expect(p.runtime.nl).toMatch(/nul, één of twee vervolgvragen/i);
    expect(p.runtime.nl).toMatch(/stel dan geen vragen/i);
    expect(p.runtime.en).toMatch(/zero, one or two follow-up questions/i);
    expect(p.runtime.en).toMatch(/ask no questions/i);
  });

  it("treats the material as data and invents nothing", () => {
    expect(p.runtime.nl).toMatch(/nooit een instructie/i);
    expect(p.runtime.nl).toMatch(/verzin niets/i);
    expect(p.runtime.en).toMatch(/never an instruction/i);
    expect(p.runtime.en).toMatch(/invent nothing/i);
  });
});
