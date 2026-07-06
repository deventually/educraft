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
import type { CountryCode } from "./countries";
import type { NlqfLevel } from "./nlqf";
import type { Sector } from "./sectors";

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

  // --- Teaching context axes (Phase 8) — all optional, all additive ---
  /** Country the programme lives in (seam; `"NL"` today). Backfilled at read time. */
  country?: CountryCode;
  /** Education sector (vo/mbo/hbo/wo) — drives the learner/teacher noun + domains. */
  sector?: Sector;
  /** Sector-scoped school-type / leerweg slug (see `TRACKS_BY_SECTOR`); most meaningful for vo. */
  track?: string;
  /**
   * The Dutch national (NLQF) level — the **source of truth** for level. The
   * engine derives and injects only the EQF number (see `derive.ts`/`format.ts`),
   * never the national label. Absent for a profile that carries no level.
   */
  nationalLevel?: NlqfLevel;
  /** mbo learner-noun override (studenten ↔ deelnemers); Dutch-only distinction. */
  learnerNounOverride?: string;
  /**
   * Free-text onderwijsconcept / didactische aanpak (Montessori, Dalton,
   * Vrijeschool, Jenaplan…). Injected verbatim like `professionalContext` —
   * deliberately not a catalogued enum (open-ended pedagogical philosophy).
   */
  pedagogy?: string;

  // --- Generic ---
  /** Opleiding, e.g. "HBO-ICT", "Verpleegkunde", "Bedrijfskunde". */
  programme?: string;
  /**
   * Sector/domain slug — validated against the sector's catalogue, not a fixed
   * enum, so it spans every sector. `HboDomain` stays the hbo subset (packs.ts).
   */
  domain?: string;
  /** Vak / cursusnaam. */
  courseName?: string;
  /**
   * vo stage (Phase 11) — onderbouw/bovenbouw. A vo-only signal (see `VO_PHASES`):
   * it fixes whether the profiel applies (bovenbouw) and scales expectations. Other
   * sectors use `studyYear` instead. Stored as a slug; no DB migration (JSON column).
   */
  phase?: "onderbouw" | "bovenbouw";
  /** Studiejaar 1–4 (hbo drives the pack level from it; mbo carries it as context). */
  studyYear?: 1 | 2 | 3 | 4;
  /**
   * EQF level (1–8). **Deprecated as an input** (Phase 8): the editor now collects
   * the national `nationalLevel` and the engine *derives* EQF (see `derive.ts`).
   * Retained because it is still the level currency the engine injects, it backs
   * the cohort synthetic profile `{ eqf: cohort.contextEqf }`, and it keeps legacy
   * profiles deserializing + resolving via `resolveLevel`'s fallback. See `eqf.ts`.
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
