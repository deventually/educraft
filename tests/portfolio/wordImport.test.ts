// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { docxToSafeNodes, type SafeNode } from "~/lib/documents/docxHtml";
import { dossierPart } from "~/lib/portfolio/dossierPart";
import { buildDossierDocx } from "~/lib/portfolio/export";
import { nodesToMarkdown, readBack, sameChapter } from "~/lib/portfolio/wordImport";
import type { DossierData } from "~/lib/portfolio/types";
import { CH, LU, sampleDossier } from "./fixtures";

const LU2 = "00000000-0000-4000-8000-000000000002";
const NOW = Date.UTC(2026, 10, 20);

const text = (t: string): SafeNode => ({ type: "text", text: t });
const el = (tag: string, ...children: (SafeNode | string)[]): SafeNode => ({
  type: "element",
  tag: tag as never,
  children: children.map((c) => (typeof c === "string" ? text(c) : c)),
});

function twoOutcomes(): DossierData {
  const d = sampleDossier();
  d.framework.outcomes.push({
    id: LU2,
    code: "LU2",
    title: "Toetsen",
    criteria: [],
    requiredEvidence: [],
  });
  d.chapters = [
    {
      id: CH,
      outcomeId: LU,
      text: "## Aanpak\n\nIk **startte** met een *vraag*.\n\n- punt een\n- punt twee\n\n| Kop A | Kop B |\n| --- | --- |\n| x | y |",
      aiDrafted: false,
    },
  ];
  d.references = [{ id: "r1", apa: "Rosenshine, B. (2012). Principles of instruction." }];
  return d;
}

describe("nodesToMarkdown", () => {
  it("turns headings, paragraphs, emphasis, lists, links and tables into Markdown", () => {
    const md = nodesToMarkdown([
      el("h2", "Aanpak"),
      el("p", "Ik ", el("strong", "startte"), " met een ", el("em", "vraag"), "."),
      el("ul", el("li", el("p", "een")), el("li", "twee")),
      el("ol", el("li", "eerst")),
      el("p", { type: "element", tag: "a", href: "https://x.nl/", children: [text("bron")] }),
      el(
        "table",
        el("tr", el("td", el("p", "Kop A")), el("td", "Kop | B")),
        el("tr", el("td", "x"), el("td", "y")),
      ),
    ]);
    expect(md).toBe(
      [
        "## Aanpak",
        "Ik **startte** met een *vraag*.",
        "- een\n- twee",
        "1. eerst",
        "[bron](https://x.nl/)",
        "| Kop A | Kop \\| B |\n| --- | --- |\n| x | y |",
      ].join("\n\n"),
    );
  });
});

describe("readBack", () => {
  it("finds each chapter under its outcome heading and skips the title page, banner and appendices", () => {
    const d = twoOutcomes();
    const nodes = [
      el("p", "CONCEPT, NIET INLEVEREN"),
      el("p", "Deze versie heeft nog open plekken."),
      el("h1", "BDB 2026"),
      el("p", "Hogeschool X"),
      el("h1", "LU1 Doceren"),
      el("p", "Nieuwe tekst over mijn les."),
      el("h2", "Aanpak"),
      el("p", "Meer."),
      el("h1", "LU2 Toetsen"),
      el("p", "(Nog geen tekst.)"),
      el("h1", "Bronnenlijst"),
      el("p", "Biggs, J. (2011). Teaching for quality learning."),
      el("p", "Rosenshine, B. (2012). Principles of instruction."),
      el("h1", "Bijlagen"),
      el("h2", "Bijlage 1. Feedback"),
      el("p", "Goede opbouw."),
      el("h1", "Mijn eigen kop"),
      el("p", "Iets nieuws"),
    ];
    const r = readBack(nodes, d);
    expect(r.chapters).toEqual([
      {
        outcomeId: LU,
        text: "Nieuwe tekst over mijn les.\n\n## Aanpak\n\nMeer.",
        changed: true,
      },
    ]);
    expect(r.references).toEqual(["Biggs, J. (2011). Teaching for quality learning."]);
    expect(r.unknownHeadings).toEqual(["Mijn eigen kop"]);
  });

  it("brings an exported draft back unchanged: a round trip through Word", async () => {
    const d = twoOutcomes();
    d.chapters.push({
      id: "ch-2",
      outcomeId: LU2,
      text: "Mijn toets. [aanvullen: de p-waarden]",
      aiDrafted: false,
    });
    const bytes = await buildDossierDocx({
      name: "BDB 2026",
      data: d,
      locale: "nl",
      now: NOW,
      draft: true,
    });
    const r = readBack(await docxToSafeNodes(bytes), d);
    expect(r.chapters.map((c) => [c.outcomeId, c.changed])).toEqual([
      [LU, false],
      [LU2, false],
    ]);
    // The open spot comes back as an open spot.
    expect(r.chapters[1]!.text).toBe("Mijn toets. [aanvullen: de p-waarden]");
    expect(r.references).toEqual([]);
  });

  it("reads one exported learning outcome too", async () => {
    const d = twoOutcomes();
    const part = dossierPart(d, LU);
    if (!part) throw new Error("no part");
    const bytes = await buildDossierDocx({
      name: "BDB 2026",
      data: part,
      locale: "en",
      now: NOW,
      subtitle: "LU1 Doceren",
    });
    const r = readBack(await docxToSafeNodes(bytes), d);
    expect(r.chapters.map((c) => [c.outcomeId, c.changed])).toEqual([[LU, false]]);
  });
});

describe("sameChapter", () => {
  it("ignores layout differences that Word introduces, not wording", () => {
    expect(sameChapter("# Kop\n\nTekst", "## Kop\n\nTekst")).toBe(true);
    expect(sameChapter("| a |\n|---|\n| b |", "| a |\n| --- |\n| b |")).toBe(true);
    expect(sameChapter("Tekst.", "Tekst!")).toBe(false);
  });
});
