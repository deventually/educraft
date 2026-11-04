/**
 * A public starting skeleton from the national agreements of the Vereniging
 * Hogescholen: the five BDB core tasks (Protocol wederzijdse erkenning BDB) and
 * BKE-1..3 (Voorstel programma van eisen BKE/SKE). Short paraphrases only, no
 * text from any institution's course material. The teacher replaces it with
 * the form of their own institution.
 */
import type { Locale } from "~/lib/i18n";
import type { Outcome, Track } from "./types";

type Text = Record<Locale, string>;
interface Seed {
  code: string;
  title: Text;
  criteria: Text[];
}

const BDB: Seed[] = [
  {
    code: "BDB-1",
    title: { nl: "Doceren", en: "Teaching" },
    criteria: [
      {
        nl: "Je bereidt onderwijssessies voor, voert ze professioneel uit en evalueert de uitvoering, met gevarieerde en activerende werkvormen.",
        en: "You prepare teaching sessions, deliver them professionally and evaluate them, using varied and activating methods.",
      },
    ],
  },
  {
    code: "BDB-2",
    title: { nl: "Begeleiden van studenten", en: "Supporting students" },
    criteria: [
      {
        nl: "Je ondersteunt het leren van studenten, bevordert open interactie en kunt studenten motiveren.",
        en: "You support students' learning, encourage open interaction and can motivate students.",
      },
    ],
  },
  {
    code: "BDB-3",
    title: { nl: "Ontwerpen van onderwijs", en: "Designing education" },
    criteria: [
      {
        nl: "Je (her)ontwerpt onderwijs dat past bij het opleidingsprofiel, de leerlijn, de onderwijsfase en de studielast.",
        en: "You (re)design education that fits the programme profile, learning line, study phase and study load.",
      },
    ],
  },
  {
    code: "BDB-4",
    title: { nl: "Toetsen", en: "Assessment" },
    criteria: [
      {
        nl: "Je neemt toetsen af, beoordeelt en analyseert de resultaten, en gebruikt formatieve en summatieve toetsing.",
        en: "You administer tests, assess and analyse the results, and use formative and summative assessment.",
      },
    ],
  },
  {
    code: "BDB-5",
    title: { nl: "Professioneel docentschap", en: "Professional teaching practice" },
    criteria: [
      {
        nl: "Je werkt planmatig en onderzoekend aan je eigen ontwikkeling en gebruikt feedback van collega's, studenten en leidinggevenden.",
        en: "You work on your own development in a planned, inquiring way and use feedback from colleagues, students and managers.",
      },
    ],
  },
];

const BKE: Seed[] = [
  {
    code: "BKE-1",
    title: { nl: "Toetscyclus", en: "Assessment cycle" },
    criteria: [
      {
        nl: "Je doorloopt de toetscyclus voor één toets en onderbouwt de keuzes per fase met toetsliteratuur.",
        en: "You go through the assessment cycle for one test and justify the choices in each phase with assessment literature.",
      },
    ],
  },
  {
    code: "BKE-2",
    title: { nl: "Toetsprogramma", en: "Assessment programme" },
    criteria: [
      {
        nl: "Je legt uit welke plek de toets heeft in het toetsprogramma van de opleiding.",
        en: "You explain the place of the test in the programme's assessment programme.",
      },
    ],
  },
  {
    code: "BKE-3",
    title: { nl: "Toetsbeleid", en: "Assessment policy" },
    criteria: [
      {
        nl: "Je benoemt wat het toetsbeleid van de instelling betekent voor je eigen toets.",
        en: "You name what the institution's assessment policy means for your own test.",
      },
    ],
  },
];

/** Fresh outcomes (new ids every call) for the chosen tracks, in one locale. */
export function skeletonOutcomes(tracks: Track[], locale: Locale): Outcome[] {
  const seeds = [...(tracks.includes("bdb") ? BDB : []), ...(tracks.includes("bke") ? BKE : [])];
  return seeds.map((s) => ({
    id: crypto.randomUUID(),
    code: s.code,
    title: s.title[locale],
    criteria: s.criteria.map((c) => ({ id: crypto.randomUUID(), text: c[locale] })),
    requiredEvidence: [],
  }));
}
