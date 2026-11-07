import { describe, it, expect } from "vitest";
import { PROMPTS } from "~/lib/prompts";

/**
 * Typos found in the Dutch runtime prompts (2026-11-07). A model reads these files
 * as instructions, so a broken word or a stray English one is a defect, not style.
 * Each entry stays here so the typo cannot come back.
 */
const KNOWN_TYPOS = [
  "leerpref erences",
  "bronnevaluatieproces",
  "verlichten —",
  "analyses voorzien",
  "bevordering kritisch denken",
  "huidge",
  "bron evaluatie",
  "genuinte",
  "hoe deze student hun onderzoek benaderen",
  "Cognitieve Leermeesterschap",
  "tegenzittingen",
  "Versprin",
  "guide de denkproces",
  "moedig voort",
  "geen medical",
  "minderaansprekingsrichtlijnen",
  "hbo-studenten volwassenen",
  "## Tone",
  "Vraagenformaat",
  "Twee-delig",
  "Begripcheck",
  "meerkeuze vraag",
  "tegenposition",
  "synthese voorbereiding",
  "leertheoricus",
  "commitmenten",
  "vorm geeft",
  "Nodigen uit",
  "ernstig interesse",
  "gekureerde",
  "evaluatiegoals",
  "Aanbevelen tools",
  "onderwijs omgevingen",
  "Openingsgespreksbeginning",
  "stuurde hun denken",
  "authentiek interesse",
];

describe("runtime prompts are free of known typos", () => {
  for (const p of Object.values(PROMPTS)) {
    it(`${p.id} (nl) has none of the known typos`, () => {
      for (const typo of KNOWN_TYPOS) expect(p.runtime.nl, typo).not.toContain(typo);
    });
  }

  it("no prompt mixes a Cyrillic letter into Latin text", () => {
    for (const p of Object.values(PROMPTS)) {
      expect(p.runtime.nl, `${p.id} nl`).not.toMatch(/\p{Script=Cyrillic}/u);
      expect(p.runtime.en, `${p.id} en`).not.toMatch(/\p{Script=Cyrillic}/u);
    }
  });
});
