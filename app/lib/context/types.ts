/**
 * A reusable teaching-context profile. Injected into any tool with
 * `usesContextProfile: true` so generated materials fit the programme.
 *
 * The model is generic across ALL hbo (Dutch higher professional education):
 * any study fills in the free-text + EQF fields. Domains that have a recognized
 * structured framework get an optional **pack** on top — a set of prefilled,
 * verified fields (e.g. hbo-i for ICT, CanMEDS for Zorg & welzijn). The pack
 * field definitions live in `packs.ts`; a profile stores only the chosen values
 * in `packValues`. Anything a pack does not cover — or a domain without a pack —
 * is captured as user-defined `customFields`. New packs are pure data additions.
 */

/** hbo sectors/domains. Each may have an optional structured pack (see packs.ts). */
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

/** A value answered for a single domain-pack field. */
export type PackFieldValue = string | string[] | number;

/** A free-form field the user defined themselves (label → value). */
export interface CustomField {
  label: string;
  value: string;
}

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

  // --- Domain pack + custom extension ---
  /** Answers to the selected domain pack's fields, keyed by the field key. */
  packValues?: Record<string, PackFieldValue>;
  /** User-defined extra fields, always available regardless of domain. */
  customFields?: CustomField[];
}
