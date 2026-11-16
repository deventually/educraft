import { describe, expect, it } from "vitest";
import { aiPatternsIn } from "~/lib/portfolio/aiPatterns";

describe("aiPatternsIn", () => {
  it("finds hollow words, in any inflection", () => {
    expect(
      aiPatternsIn("Deze cruciale les was heel waardevol en essentieel voor de groep."),
    ).toEqual([
      { kind: "hollow", text: "cruciale" },
      { kind: "hollow", text: "waardevol" },
      { kind: "hollow", text: "essentieel" },
    ]);
  });

  it("finds a sentence that only stresses importance", () => {
    expect(aiPatternsIn("Dit onderstreept het belang van goede feedback.")).toEqual([
      { kind: "emphasis", text: "onderstreept het belang van" },
    ]);
  });

  it("finds 'niet alleen … maar ook' within one sentence", () => {
    expect(aiPatternsIn("Ik leerde niet alleen over toetsen, maar ook over mezelf.")).toEqual([
      { kind: "contrast", text: "niet alleen over toetsen, maar ook" },
    ]);
    expect(aiPatternsIn("Niet alleen ik. Maar ook zij.")).toEqual([]);
  });

  it("finds an em dash, and an en dash used as a dash", () => {
    expect(aiPatternsIn("De groep — vooral de tweedejaars – deed mee.")).toEqual([
      { kind: "dash", text: "—" },
      { kind: "dash", text: "–" },
    ]);
  });

  it("finds a summarising opener only at the start of a sentence", () => {
    expect(
      aiPatternsIn("De les liep uit. Kortom, ik plan ruimer.\nAl met al ging het goed."),
    ).toEqual([
      { kind: "wrapUp", text: "Kortom" },
      { kind: "wrapUp", text: "Al met al" },
    ]);
    expect(aiPatternsIn("Ik zei het kortom niet.")).toEqual([]);
  });

  it("finds the same patterns in English", () => {
    expect(
      aiPatternsIn(
        "This pivotal lesson underscores the importance of feedback. In conclusion, it was not only fun but also useful.",
      ),
    ).toEqual([
      { kind: "hollow", text: "pivotal" },
      { kind: "emphasis", text: "underscores the importance of" },
      { kind: "wrapUp", text: "In conclusion" },
      { kind: "contrast", text: "not only fun but also" },
    ]);
  });

  it("raises no false alarm on concrete text", () => {
    const text =
      "Ik gaf 24 tweedejaars een casus over de longen (blz. 3–5, studiejaar 2025-2026). " +
      "Een student vroeg: 'Moet dit in de toets?' Daarom liet ik de essentie zien. " +
      "Ik zeg nu eerst wat het lesdoel is; zo weten ze waar ze naartoe werken.";
    expect(aiPatternsIn(text)).toEqual([]);
  });

  it("finds nothing in an empty text", () => {
    expect(aiPatternsIn("")).toEqual([]);
  });
});
