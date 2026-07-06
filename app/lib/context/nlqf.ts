/**
 * The Dutch national qualifications framework (NLQF) — the national level model
 * stored on a profile, from which the engine derives the country-neutral EQF
 * number. NLQF is the source of truth for level; `eqf.ts` stays the injection
 * spine (only "EQF n" + the neutral directive ever reaches a prompt).
 *
 * Facts verified against nlqf.nl (see the NLQF "waaier"):
 *   - NLQF = an Instroomniveau + levels 1–8, coupled 1:1 to EQF (NLQF n → EQF n).
 *   - An extra **NLQF 4+ / EQF 4** rung exists ("formeel onderwijs", i.e. vwo);
 *     it derives EQF 4 like plain NLQF 4.
 *   - The **Instroomniveau is genuinely below EQF 1 and cannot be coupled to EQF.**
 *     Mapping it to EQF 1 for injection is a *documented engine approximation*,
 *     paired with a neutral "entry-level" note (see `format.ts`), not a claim that
 *     Instroom == EQF 1.
 *
 * The NLQF labels below are a UI affordance only (a Dutch teacher's familiar
 * anchors) — they never appear in the injected block, so no national term leaks.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { EqfLevel } from "./types";

/** A stored NLQF level: the Instroomniveau, levels 1–8, or the 4+ rung. */
export type NlqfLevel = "instroom" | "1" | "2" | "3" | "4" | "4+" | "5" | "6" | "7" | "8";

/** Every NLQF level low → high, the order shown in the level picker. */
export const NLQF_LEVEL_ORDER: readonly NlqfLevel[] = [
  "instroom",
  "1",
  "2",
  "3",
  "4",
  "4+",
  "5",
  "6",
  "7",
  "8",
];

export interface NlqfLevelOption {
  level: NlqfLevel;
  label: LocalizedText;
}

/**
 * The picker catalogue. NL labels carry indicative Dutch qualification anchors
 * (the diploma inschaling, verified against nlqf.nl / Staatscourant 2024-34565);
 * EN labels name the NLQF level plainly. UI-only — never injected.
 */
export const NLQF_LEVELS: readonly NlqfLevelOption[] = [
  {
    level: "instroom",
    label: { nl: "Instroomniveau (nog vóór niveau 1)", en: "Entry level (below level 1)" },
  },
  { level: "1", label: { nl: "NLQF 1 — vmbo-bb · mbo entree", en: "NLQF 1" } },
  { level: "2", label: { nl: "NLQF 2 — vmbo-kb/gl/tl · mbo-2", en: "NLQF 2" } },
  { level: "3", label: { nl: "NLQF 3 — mbo-3", en: "NLQF 3" } },
  { level: "4", label: { nl: "NLQF 4 — mbo-4 · havo", en: "NLQF 4" } },
  { level: "4+", label: { nl: "NLQF 4+ — vwo", en: "NLQF 4+" } },
  { level: "5", label: { nl: "NLQF 5 — associate degree", en: "NLQF 5" } },
  { level: "6", label: { nl: "NLQF 6 — hbo-/wo-bachelor", en: "NLQF 6" } },
  { level: "7", label: { nl: "NLQF 7 — master", en: "NLQF 7" } },
  { level: "8", label: { nl: "NLQF 8 — doctoraat (PhD)", en: "NLQF 8" } },
];

export const NLQF_SOURCE: LocalizedText = {
  nl: "NLQF (Nederlands Kwalificatieraamwerk)",
  en: "NLQF (Dutch Qualifications Framework)",
};

/** The verified deep-link to the NLQF levels "waaier" (see nlqf.nl). */
export const NLQF_SOURCE_URL = "https://nlqf.nl/impact-nlqf/nlqf-niveaus-waaier/";

/** Runtime guard: is `s` a valid stored NLQF level? */
export function isNlqfLevel(s: string): s is NlqfLevel {
  return (NLQF_LEVEL_ORDER as readonly string[]).includes(s);
}

/**
 * Derive the country-neutral EQF number from an NLQF level. `entryLevel` is true
 * only for the Instroomniveau — the documented approximation to EQF 1 that the
 * engine pairs with a neutral entry-level note.
 */
export function nlqfToEqf(level: NlqfLevel): { eqf: EqfLevel; entryLevel: boolean } {
  if (level === "instroom") return { eqf: 1, entryLevel: true };
  if (level === "4+") return { eqf: 4, entryLevel: false };
  return { eqf: Number(level) as EqfLevel, entryLevel: false };
}
