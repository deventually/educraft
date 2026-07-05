/**
 * The European Qualifications Framework (EQF) — LimeOnIt's country-neutral level
 * spine. EQF is an 8-level reference adopted across the EU/EEA and candidate
 * countries; each country maps its own National Qualifications Framework (NQF)
 * onto these eight levels. So "EQF {n}" is the one level currency that travels
 * across borders.
 *
 * Design note (internationalisation): the *only* thing the engine injects about
 * level is the EQF NUMBER plus a neutral adaptation directive (see
 * `context/format.ts`). It never injects a country-specific label. That is what
 * makes level-adaptation work for any EQF country out of the box, while staying
 * Dutch-first. The labels below are a UI affordance only:
 *   - the NL label carries indicative Dutch (NLQF) anchors — a familiar hook for
 *     a Dutch teacher choosing a level;
 *   - the EN label is deliberately country-NEUTRAL, using EQF-native terms, so a
 *     teacher in any country using the English UI never sees Dutch-only terms.
 * A future country pack can swap the NL anchor for its own national framework
 * without touching the engine — capability grows by data, not branching.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { EqfLevel } from "./types";

export const EQF_MIN = 1;
export const EQF_MAX = 8;

export interface EqfLevelOption {
  level: EqfLevel;
  label: LocalizedText;
}

/**
 * The full ladder, low → high. NL anchors are *indicative* NLQF→EQF placements
 * (nlqf.nl): the same EQF level can map to several Dutch qualifications, so these
 * name the most common ones as a hint, not an exhaustive rule. EN terms are the
 * EQF-native / short-cycle-tertiary vocabulary, chosen to read correctly in any
 * EQF member country.
 */
export const EQF_LEVELS: readonly EqfLevelOption[] = [
  {
    level: 1,
    label: { nl: "EQF 1 — instroom (entree / vmbo-bb)", en: "EQF 1 — basic / entry level" },
  },
  {
    level: 2,
    label: {
      nl: "EQF 2 — vmbo kb/gl/tl · mbo-2",
      en: "EQF 2 — lower secondary / basic vocational",
    },
  },
  { level: 3, label: { nl: "EQF 3 — mbo-3", en: "EQF 3 — intermediate vocational" } },
  {
    level: 4,
    label: { nl: "EQF 4 — mbo-4 · havo/vwo", en: "EQF 4 — upper secondary / vocational" },
  },
  {
    level: 5,
    label: { nl: "EQF 5 — associate degree", en: "EQF 5 — short-cycle tertiary (associate)" },
  },
  { level: 6, label: { nl: "EQF 6 — bachelor", en: "EQF 6 — bachelor" } },
  { level: 7, label: { nl: "EQF 7 — master", en: "EQF 7 — master" } },
  { level: 8, label: { nl: "EQF 8 — doctoraat (PhD)", en: "EQF 8 — doctorate" } },
];

/** Runtime guard: is `n` a whole EQF level in range? */
export function isEqfLevel(n: number): n is EqfLevel {
  return Number.isInteger(n) && n >= EQF_MIN && n <= EQF_MAX;
}
