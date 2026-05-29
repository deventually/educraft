/**
 * A reusable teaching-context profile. Injected into any tool with
 * `usesContextProfile: true` so generated materials fit the programme.
 *
 * The model is generic across ALL hbo (Dutch higher professional education):
 * any study fills in the free-text + EQF fields. Domains that have a recognized
 * structured framework get an optional "pack" on top — hbo-i (ICT) is the first,
 * contributing architecture layers, professional activities and a 1–3 level.
 * New packs can be added later without reshaping the base.
 */

/** hbo sectors/domains. ICT (hbo-i) is the first with a structured pack. */
export const HBO_DOMAINS = [
  "ICT",
  "Techniek",
  "Economie & management",
  "Zorg & welzijn",
  "Onderwijs",
  "Sociale studies",
  "Kunst & creatief",
  "Recht",
  "Agro, voeding & leefomgeving",
  "Overig",
] as const;
export type HboDomain = (typeof HBO_DOMAINS)[number];

// --- hbo-i (ICT) pack ------------------------------------------------------

export const HBOI_ARCHITECTURE_LAYERS = [
  "Gebruikersinteractie",
  "Organisatieprocessen",
  "Infrastructuur",
  "Software",
  "Hardware-interfacing",
] as const;
export type HboiArchitectureLayer = (typeof HBOI_ARCHITECTURE_LAYERS)[number];

export const HBOI_ACTIVITIES = [
  "Analyseren",
  "Adviseren",
  "Ontwerpen",
  "Realiseren",
  "Beheren",
] as const;
export type HboiActivity = (typeof HBOI_ACTIVITIES)[number];

/**
 * Bilingual labels for the hbo-i framework terms. The array values above stay
 * the canonical (Dutch) identifiers (used as form values + stored); these maps
 * are the single source for displaying/injecting them in either language —
 * consumed by both the settings UI and the prompt context formatter.
 */
export const HBOI_ARCHITECTURE_LAYER_LABELS: Record<
  HboiArchitectureLayer,
  { nl: string; en: string }
> = {
  Gebruikersinteractie: { nl: "Gebruikersinteractie", en: "User interaction" },
  Organisatieprocessen: { nl: "Organisatieprocessen", en: "Business processes" },
  Infrastructuur: { nl: "Infrastructuur", en: "Infrastructure" },
  Software: { nl: "Software", en: "Software" },
  "Hardware-interfacing": { nl: "Hardware-interfacing", en: "Hardware interfacing" },
};

export const HBOI_ACTIVITY_LABELS: Record<HboiActivity, { nl: string; en: string }> = {
  Analyseren: { nl: "Analyseren", en: "Analysis" },
  Adviseren: { nl: "Adviseren", en: "Advice" },
  Ontwerpen: { nl: "Ontwerpen", en: "Design" },
  Realiseren: { nl: "Realiseren", en: "Realisation" },
  Beheren: { nl: "Beheren", en: "Management" },
};

export interface ContextProfile {
  id: string;
  /** e.g. "Software Engineering — jaar 2" or "Verpleegkunde — jaar 3". */
  name: string;

  // --- Generic (all hbo) ---
  /** Opleiding, e.g. "HBO-ICT", "Verpleegkunde", "Bedrijfskunde". */
  programme?: string;
  /** Sector/domain — drives which optional pack applies. */
  domain?: HboDomain;
  /** Vak / cursusnaam. */
  courseName?: string;
  /** Studiejaar 1–4. */
  studyYear?: 1 | 2 | 3 | 4;
  /** EQF-niveau (5/6/7) — het enige niveau dat over alle hbo-opleidingen geldt. */
  eqf?: 5 | 6 | 7;
  /** Beoogde competenties / leeruitkomsten (vrije tekst). */
  competencies?: string;
  /** Beroepspraktijk / werkveld waarvoor wordt opgeleid (vrije tekst). */
  professionalContext?: string;
  /** Technologie, methoden of instrumenten, bijv. "Java", "SPSS", "verpleegtechnieken". */
  tools?: string;
  /** Vrije aanvullende context, woordelijk meegegeven aan het model. */
  notes?: string;

  // --- hbo-i (ICT) pack — only meaningful when domain === "ICT" ---
  /** HBO-i architectuurlagen. */
  architectureLayers?: HboiArchitectureLayer[];
  /** HBO-i beroepsactiviteiten. */
  activities?: HboiActivity[];
  /** HBO-i beheersingsniveau 1–3. */
  hboiLevel?: 1 | 2 | 3;
}
