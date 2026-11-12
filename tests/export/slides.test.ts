import { describe, expect, it } from "vitest";
import { toExportDoc } from "~/lib/export/doc";
import { MAX_POINTS, toSlideDeck } from "~/lib/export/slides";

const outline = {
  opening: "Leerdoel en succescriterium",
  phases: "Lesverloop",
  closing: "Terugkomen in volgende lessen",
};

const lesson = [
  "## Let op vooraf",
  "",
  "De stof past net.",
  "",
  "## Leerdoel en succescriterium",
  "",
  "De student berekent de **oppervlakte** van een driehoek.",
  "",
  "Succescriterium: drie van de vier opgaven goed.",
  "",
  "## Tijdsplan",
  "",
  "| Fase | Minuten |",
  "| --- | --- |",
  "| Voorkennis ophalen | 10 |",
  "",
  "## Lesverloop",
  "",
  "### Voorkennis ophalen (10 min)",
  "",
  "De docent stelt drie vragen op wisbordjes.",
  "",
  "1. Wat is een rechthoek?",
  "2. Hoe bereken je de oppervlakte van een rechthoek?",
  "",
  "### Uitleg in kleine stappen (15 min)",
  "",
  "De docent doet hardop voor.",
  "",
  "## Terugkomen in volgende lessen",
  "",
  "- Volgende week: een driehoek met een stompe hoek.",
  "- Over een maand: de oppervlakte van een trapezium.",
  "",
  "## Check op de opzet",
  "",
  "Telt op: ja.",
  "",
  "Dit is een concept. De docent past de les aan op de eigen groep.",
].join("\n");

function deckOf(markdown: string, locale: "nl" | "en" = "nl") {
  const doc = toExportDoc({
    title: "Les voorbereiden",
    locale,
    sections: [{ heading: null, kind: "slides", slides: outline, markdown }],
  });
  return toSlideDeck(doc);
}

describe("toSlideDeck (P30.4)", () => {
  it("makes an opening slide, a slide per phase and a closing slide, in order", () => {
    const deck = deckOf(lesson);
    expect(deck.title).toBe("Les voorbereiden");
    expect(deck.locale).toBe("nl");
    expect(deck.slides.map((s) => s.title)).toEqual([
      "Leerdoel en succescriterium",
      "Voorkennis ophalen (10 min)",
      "Uitleg in kleine stappen (15 min)",
      "Terugkomen in volgende lessen",
    ]);
  });

  it("puts the learning goal and success criterion on the opening slide, as plain text", () => {
    const [opening] = deckOf(lesson).slides;
    expect(opening?.points).toEqual([
      "De student berekent de oppervlakte van een driehoek.",
      "Succescriterium: drie van de vier opgaven goed.",
    ]);
  });

  it("puts a phase's steps on the slide and the explanation for the teacher in the notes", () => {
    const phase = deckOf(lesson).slides[1];
    expect(phase?.points).toEqual([
      "Wat is een rechthoek?",
      "Hoe bereken je de oppervlakte van een rechthoek?",
    ]);
    expect(phase?.notes).toContain("De docent stelt drie vragen op wisbordjes.");
    // The notes never repeat what is already on the slide.
    expect(phase?.notes).toBe("De docent stelt drie vragen op wisbordjes.");
    expect(phase?.points.join(" ")).not.toContain("wisbordjes");
  });

  it("puts the expected answers of lesson-plan@v2 in the notes, never on the slide", () => {
    const phase = deckOf(
      "## Lesverloop\n\n### Check op begrip (10 min)\n\n1. Wat is 4 × 6 m²?\n2. Welke eenheid?\n**Verwachte antwoorden:** 1. 24 m². 2. m².",
    ).slides[0];
    expect(phase?.points).toEqual(["Wat is 4 × 6 m²?", "Welke eenheid?"]);
    expect(phase?.notes).toBe("Verwachte antwoorden: 1. 24 m². 2. m².");
  });

  it("leaves a phase without steps with only its title, its text in the notes", () => {
    const phase = deckOf(lesson).slides[2];
    expect(phase?.points).toEqual([]);
    expect(phase?.notes).toBe("De docent doet hardop voor.");
  });

  it("never puts the time plan, the notes up front or the check on a slide", () => {
    const all = JSON.stringify(deckOf(lesson).slides);
    expect(all).not.toContain("De stof past net");
    expect(all).not.toContain("| 10");
    expect(all).not.toContain("Telt op");
    expect(all).not.toContain("Dit is een concept");
  });

  it(`splits a slide with more than ${MAX_POINTS} points, never making the text smaller`, () => {
    const steps = Array.from({ length: MAX_POINTS + 2 }, (_, i) => `- Stap ${i + 1}`).join("\n");
    const deck = deckOf(`## Lesverloop\n\n### Begeleide oefening (20 min)\n\nUitleg.\n\n${steps}`);
    expect(deck.slides.map((s) => s.title)).toEqual([
      "Begeleide oefening (20 min)",
      "Begeleide oefening (20 min) (vervolg)",
    ]);
    expect(deck.slides[0]?.points).toHaveLength(MAX_POINTS);
    expect(deck.slides[1]?.points).toEqual([`Stap ${MAX_POINTS + 1}`, `Stap ${MAX_POINTS + 2}`]);
    expect(deck.slides[1]?.notes).toBe(deck.slides[0]?.notes);
  });

  it("says 'continued' in an English deck", () => {
    const steps = Array.from({ length: MAX_POINTS + 1 }, (_, i) => `- Step ${i + 1}`).join("\n");
    const deck = deckOf(`## Lesverloop\n\n### Guided practice (20 min)\n\n${steps}`, "en");
    expect(deck.slides[1]?.title).toBe("Guided practice (20 min) (continued)");
  });

  it("finds the headings whatever their level, case or a trailing colon", () => {
    const deck = deckOf("# LESVERLOOP:\n\n## Afsluiting (5 min)\n\n- Exitvraag");
    expect(deck.slides.map((s) => s.title)).toEqual(["Afsluiting (5 min)"]);
  });

  it("makes no slides from an empty lesson plan or one without the headings", () => {
    expect(deckOf("").slides).toEqual([]);
    expect(deckOf("Gewoon een tekst zonder kopjes.").slides).toEqual([]);
  });

  it("reads only steps of a result that are slides", () => {
    const doc = toExportDoc({
      title: "Twee stappen",
      locale: "nl",
      sections: [
        { heading: "Toets", markdown: "## Lesverloop\n\n### Niet dit (5 min)\n\n- x" },
        { heading: "Les", kind: "slides", slides: outline, markdown: lesson },
      ],
    });
    expect(toSlideDeck(doc).slides[0]?.title).toBe("Leerdoel en succescriterium");
    expect(JSON.stringify(toSlideDeck(doc))).not.toContain("Niet dit");
  });
});
