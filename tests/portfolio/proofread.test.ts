import { describe, expect, it } from "vitest";
import {
  PROOFREAD_LIMITS,
  applySuggestion,
  buildProofreadMessage,
  locateQuote,
  parseProofread,
} from "~/lib/portfolio/proofread";
import type { DossierData } from "~/lib/portfolio/types";
import { LU, sampleDossier } from "./fixtures";

const CHAPTER =
  "In week 4 gaf ik een les over procesanalyse. De studenten werkte in tweetallen.\n\nIk koos voor tweetallen omdat “iedereen actief is” (Lemov, 2015).";

function dossier(text = CHAPTER): DossierData {
  const d = sampleDossier();
  return {
    ...d,
    chapters: [{ ...d.chapters[0]!, text }],
    references: [{ id: "r1", apa: "Lemov, D. (2015). Teach like a champion 2.0. Jossey-Bass." }],
  };
}

const answer = (suggestions: unknown[]) => JSON.stringify({ suggestions });

describe("buildProofreadMessage", () => {
  it("sends the chapter and the reference list as tagged data", () => {
    const m = buildProofreadMessage(dossier(), LU, "nl");
    expect(m).toContain("<chapter>\nIn week 4");
    expect(m).toContain("<references>\n- Lemov, D. (2015)");
    expect(m).toContain("LU1 Doceren");
  });

  it("says when there are no references", () => {
    const d = { ...dossier(), references: [] };
    expect(buildProofreadMessage(d, LU, "en")).toContain("<references>\n(none)\n</references>");
  });
});

describe("locateQuote", () => {
  it("returns the chapter's own span, modulo whitespace and quote style", () => {
    expect(locateQuote("De studenten werkte in tweetallen.", CHAPTER)).toBe(
      "De studenten werkte in tweetallen.",
    );
    expect(locateQuote('omdat "iedereen actief is"', CHAPTER)).toBe("omdat “iedereen actief is”");
    expect(locateQuote("procesanalyse.  De   studenten", CHAPTER)).toBe(
      "procesanalyse. De studenten",
    );
    expect(locateQuote("tweetallen.\nIk koos", CHAPTER)).toBe("tweetallen.\n\nIk koos");
  });

  it("refuses text that is not in the chapter, elisions and empty quotes", () => {
    expect(locateQuote("De studenten werkten in tweetallen.", CHAPTER)).toBeNull();
    expect(locateQuote("In week 4 … procesanalyse", CHAPTER)).toBeNull();
    expect(locateQuote("   ", CHAPTER)).toBeNull();
  });
});

describe("parseProofread", () => {
  it("keeps a suggestion whose sentence is in the chapter, quoted as the chapter has it", () => {
    const r = parseProofread(
      answer([
        {
          quote: 'omdat "iedereen actief is" (Lemov, 2015).',
          issue: "apa",
          explanation: "Bij een letterlijk citaat hoort een paginanummer.",
          suggestion: 'omdat "iedereen actief is" (Lemov, 2015, p. 12).',
        },
      ]),
      dossier(),
      LU,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.suggestions).toEqual([
      {
        quote: "omdat “iedereen actief is” (Lemov, 2015).",
        issue: "apa",
        explanation: "Bij een letterlijk citaat hoort een paginanummer.",
        suggestion: 'omdat "iedereen actief is" (Lemov, 2015, p. 12).',
      },
    ]);
    expect(r.dropped).toBe(0);
  });

  it("drops a suggestion whose sentence is not literally in the chapter", () => {
    const r = parseProofread(
      answer([
        {
          quote: "De studenten werkten graag in tweetallen.",
          issue: "grammar",
          explanation: "x",
          suggestion: "y",
        },
        {
          quote: "De studenten werkte in tweetallen.",
          issue: "grammar",
          explanation: "Onderwerp en werkwoord: meervoud.",
          suggestion: "De studenten werkten in tweetallen.",
        },
      ]),
      dossier(),
      LU,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.suggestions.map((s) => s.suggestion)).toEqual(["De studenten werkten in tweetallen."]);
    expect(r.dropped).toBe(1);
  });

  it("drops no-op suggestions, duplicates and sources the teacher does not cite", () => {
    const fix = {
      quote: "De studenten werkte in tweetallen.",
      issue: "grammar",
      explanation: "Meervoud.",
      suggestion: "De studenten werkten in tweetallen.",
    };
    const r = parseProofread(
      answer([
        fix,
        { ...fix, explanation: "Nogmaals." },
        { ...fix, suggestion: "De studenten werkte in tweetallen." },
        {
          quote: "In week 4 gaf ik een les over procesanalyse.",
          issue: "style",
          explanation: "Onderbouw met literatuur.",
          suggestion: "In week 4 gaf ik een les over procesanalyse (Hattie, 2009).",
        },
      ]),
      dossier(),
      LU,
    );
    if (!r.ok) throw new Error(r.error);
    expect(r.suggestions).toHaveLength(1);
    expect(r.dropped).toBe(3);
  });

  it("maps an unknown issue to style and caps the list", () => {
    const n = PROOFREAD_LIMITS.suggestions + 5;
    const text = Array.from({ length: n }, (_, i) => `Zin ${i} staat hier.`).join(" ");
    const many = Array.from({ length: n }, (_, i) => ({
      quote: `Zin ${i} staat hier.`,
      issue: i === 0 ? "weird" : "spelling",
      explanation: `uitleg ${i}`,
      suggestion: `Zin ${i} staat daar.`,
    }));
    const r = parseProofread(answer(many), dossier(text), LU);
    if (!r.ok) throw new Error(r.error);
    expect(r.suggestions).toHaveLength(PROOFREAD_LIMITS.suggestions);
    expect(r.suggestions[0]!.issue).toBe("style");
  });

  it("accepts an empty list (a clean chapter) and refuses an unparseable answer", () => {
    expect(parseProofread(answer([]), dossier(), LU)).toEqual({
      ok: true,
      suggestions: [],
      dropped: 0,
    });
    expect(parseProofread("geen json", dossier(), LU)).toEqual({
      ok: false,
      error: "unparseable",
    });
  });
});

describe("applySuggestion", () => {
  it("replaces the first occurrence of the quoted span, and nothing else", () => {
    expect(
      applySuggestion(CHAPTER, {
        quote: "De studenten werkte in tweetallen.",
        suggestion: "De studenten werkten in tweetallen.",
      }),
    ).toBe(CHAPTER.replace("werkte in", "werkten in"));
  });

  it("returns null when the sentence is no longer in the chapter", () => {
    expect(applySuggestion("Andere tekst.", { quote: "Weg.", suggestion: "Ook weg." })).toBeNull();
  });
});
