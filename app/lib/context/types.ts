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

/**
 * EQF (European Qualifications Framework) level — the country-neutral 1–8 spine
 * covering the whole education ladder (basic → doctorate). See `context/eqf.ts`
 * for the level catalogue and the internationalisation rationale.
 */
export type EqfLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

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
  /**
   * EQF level (1–8) — the country-neutral level measure spanning the whole
   * education ladder (basic/vocational/secondary → bachelor/master/doctorate),
   * usable in any EQF country. The engine injects only this number plus a generic
   * adaptation directive (see `format.ts`), never a country-specific label. See
   * `eqf.ts`.
   */
  eqf?: EqfLevel;
  /**
   * @deprecated Legacy. No longer collected or injected: competencies are
   * per-task and every generator tool already asks for them, so injecting them
   * here only duplicated and diluted the task. Kept on the type so older stored
   * profiles still deserialize without a migration.
   */
  competencies?: string;
  /** Beroepspraktijk / werkveld waarvoor wordt opgeleid (vrije tekst). */
  professionalContext?: string;
  /** Technologie, methoden of instrumenten, bijv. "Java", "SPSS", "verpleegtechnieken". */
  tools?: string;
  /**
   * @deprecated Legacy. No longer collected or injected: free-text notes were
   * passed verbatim and competed with the tool's own task instruction. Kept on
   * the type so older stored profiles still deserialize without a migration.
   */
  notes?: string;

  // --- Domain pack + custom extension ---
  /** Answers to the selected domain pack's fields, keyed by the field key. */
  packValues?: Record<string, PackFieldValue>;
  /** User-defined extra fields, always available regardless of domain. */
  customFields?: CustomField[];
}
