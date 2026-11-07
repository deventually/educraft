import { describe, expect, it } from "vitest";
import {
  extractQuotes,
  locateAll,
  locateQuote,
  normalizeForMatch,
  quoteSpans,
} from "~/lib/documents/locate";

/**
 * "Toon in document": a quote from the AI result is found back in the original,
 * despite PDF line breaks, hyphenation and typographic quotes — and never matched
 * to the wrong place (24.0c).
 */
describe("normalizeForMatch", () => {
  it("collapses whitespace, lowercases and unifies typographic quotes and dashes", () => {
    expect(normalizeForMatch("  De  Student\n\tzegt “ja” – echt  ")).toBe(
      'de student zegt "ja" - echt',
    );
  });

  it("joins words split by a hyphen at a line break, and drops soft hyphens", () => {
    expect(normalizeForMatch("afbreek-\nstreepjes")).toBe("afbreekstreepjes");
    expect(normalizeForMatch("afbreek­streepjes")).toBe("afbreekstreepjes");
    // The same rule on both sides keeps a quote with an ordinary hyphen matchable.
    expect(normalizeForMatch("e-mail")).toBe(normalizeForMatch("e- mail"));
  });
});

describe("locateQuote", () => {
  const pages = [
    "Hoofdstuk 1 Inleiding\nDe stage vond plaats bij een\nwebshop in sportartikelen.",
    "In de reflectie schrijft de student dat zij de feed-\nback van haar begeleider\nhet meest waardevol vond.",
  ];

  it("finds a quote on the right page despite line breaks and hyphenation", () => {
    const hit = locateQuote(pages, "de feedback van haar begeleider het meest waardevol vond");
    expect(hit.status).toBe("found");
    if (hit.status !== "found") return;
    expect(hit.segment).toBe(1);
    // Offsets point into the original page text, so the viewer can mark it.
    expect(pages[1].slice(hit.start, hit.end)).toBe(
      "de feed-\nback van haar begeleider\nhet meest waardevol vond",
    );
  });

  it("ignores the surrounding quote marks and case of the cited text", () => {
    const hit = locateQuote(pages, "“De stage vond plaats bij een webshop”");
    expect(hit).toMatchObject({ status: "found", segment: 0 });
  });

  it("uses the longest fragment when the quote leaves something out with an ellipsis", () => {
    const hit = locateQuote(pages, "De stage vond plaats … in sportartikelen bij een webshop");
    // "in sportartikelen bij een webshop" is not verbatim, "De stage vond plaats" is.
    expect(hit.status).toBe("notFound");
    const ok = locateQuote(pages, "Hoofdstuk 1 … De stage vond plaats bij een webshop");
    expect(ok).toMatchObject({ status: "found", segment: 0 });
  });

  it("reports a quote that crosses into the next page on the page where it starts", () => {
    const hit = locateQuote(pages, "webshop in sportartikelen. In de reflectie schrijft");
    expect(hit).toMatchObject({ status: "found", segment: 0 });
  });

  it("does not report a false hit for a paraphrase", () => {
    expect(locateQuote(pages, "de student vond de feedback van de begeleider waardevol")).toEqual({
      status: "notFound",
    });
  });

  it("refuses a fragment too short to be a reliable match", () => {
    expect(locateQuote(pages, "de stage")).toEqual({ status: "tooShort" });
  });

  it("counts how often a quote occurs", () => {
    const hit = locateQuote(
      ["een zin die terugkomt.", "en nog eens: een zin die terugkomt."],
      "een zin die terugkomt",
    );
    expect(hit).toMatchObject({ status: "found", segment: 0, matches: 2 });
  });
});

describe("locateAll (the search field)", () => {
  it("returns every match in reading order with its page", () => {
    const hits = locateAll(["Stage bij A.", "Geen.", "Weer een stage."], "stage");
    expect(hits.map((h) => h.segment)).toEqual([0, 2]);
  });

  it("returns nothing for an empty query", () => {
    expect(locateAll(["iets"], "  ")).toEqual([]);
  });
});

describe("extractQuotes", () => {
  it("collects quoted passages and blockquotes from the result, without duplicates", () => {
    const md = [
      "**Onderbouwing:** de student schrijft “ik heb de klant elke week gesproken” (p. 4).",
      'Ook: "de planning liep twee weken uit door de migratie" (hoofdstuk 3).',
      "> Ik heb geleerd om eerder om hulp te vragen bij mijn begeleider.",
      "Herhaling: “ik heb de klant elke week gesproken”.",
      "Kort: “ja”, en het woord ‘stage’.",
    ].join("\n");
    expect(extractQuotes(md)).toEqual([
      "ik heb de klant elke week gesproken",
      "de planning liep twee weken uit door de migratie",
      "Ik heb geleerd om eerder om hulp te vragen bij mijn begeleider.",
    ]);
  });

  it("ignores apostrophes in Dutch words", () => {
    expect(
      extractQuotes("De auto's en foto's van de cliënt's bedrijf zijn niet relevant."),
    ).toEqual([]);
  });
});

describe("quoteSpans", () => {
  it("finds the quoted passages in one line of text, with their place", () => {
    const text = 'Zij schrijft “ik heb de klant elke week gesproken” en "ja" (p. 2).';
    const spans = quoteSpans(text);
    expect(spans).toEqual([
      {
        start: text.indexOf("“"),
        end: text.indexOf("”") + 1,
        quote: "ik heb de klant elke week gesproken",
      },
    ]);
  });

  it("returns the same quotes as extractQuotes, so a found quote can be matched back", () => {
    const line = "„de planning liep twee weken uit door de migratie” en ‘stage’";
    expect(quoteSpans(line).map((s) => s.quote)).toEqual(extractQuotes(line));
  });
});
