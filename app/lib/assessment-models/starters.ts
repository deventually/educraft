import type { Locale } from "~/lib/i18n";
import hboiStage from "./starters/hbo-i-stage.md?raw";
import thesisNl from "./starters/afstudeerscriptie.nl.md?raw";
import thesisEn from "./starters/afstudeerscriptie.en.md?raw";
import reportNl from "./starters/onderzoeksverslag.nl.md?raw";
import reportEn from "./starters/onderzoeksverslag.en.md?raw";
import essayNl from "./starters/essay.nl.md?raw";
import essayEn from "./starters/essay.en.md?raw";

type Text = Record<Locale, string>;

/** A ready-made model a teacher can pick or copy; never filled in unasked. */
export interface StarterModel {
  id: string;
  name: Text;
  documentTypes: string[];
  framework: Text;
  scale: Text;
}

const OVG: Text = {
  nl: "Indicatie per criterium: Onvoldoende, Voldoende of Goed.\nSlaagregel: het werk is voldoende als geen enkel criterium Onvoldoende is (geen middeling).",
  en: "Indication per criterion: Insufficient, Sufficient or Good.\nPass rule: the work passes when no criterion is Insufficient (no averaging).",
};

const HBOI_SCALE = `Schaal: Onvoldoende (O) = 0 punten · Voldoende (V) = 6 punten · Goed (G) = 10 punten.
Slaagregel: zodra één onderdeel/succescriterium Onvoldoende is, is het eindresultaat Onvoldoende (geen middeling).
HBO-i stage: Analyseren wordt beoordeeld met O/V/G, Realiseren met een afgerond cijfer; beide wegen 50%. Voor een voldoende stage is het eindcijfer minimaal 6, is het stagedossier compleet en is geen enkel onderdeel Onvoldoende.`;

export const STARTER_MODELS: StarterModel[] = [
  {
    id: "hbo-i-stage",
    name: { nl: "HBO-i stage (Informatica)", en: "HBO-i internship (Informatica)" },
    documentTypes: ["stageverslag", "onderzoeksverslag", "stageplan", "portfolio"],
    // A Dutch programme's own rubric: the same text in both languages.
    framework: { nl: hboiStage, en: hboiStage },
    scale: { nl: HBOI_SCALE, en: HBOI_SCALE },
  },
  {
    id: "afstudeerscriptie",
    name: { nl: "Afstudeerscriptie (algemeen)", en: "Graduation thesis (general)" },
    documentTypes: ["afstudeerscriptie"],
    framework: { nl: thesisNl, en: thesisEn },
    scale: OVG,
  },
  {
    id: "onderzoeksverslag",
    name: {
      nl: "Onderzoeksverslag of rapport (algemeen)",
      en: "Research or other report (general)",
    },
    documentTypes: ["onderzoeksverslag", "adviesrapport", "verslag"],
    framework: { nl: reportNl, en: reportEn },
    scale: OVG,
  },
  {
    id: "essay",
    name: { nl: "Essay (algemeen)", en: "Essay (general)" },
    documentTypes: ["essay"],
    framework: { nl: essayNl, en: essayEn },
    scale: OVG,
  },
];
