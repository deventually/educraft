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
 * Dutch-first.
 * A future country pack maps its own national framework onto these levels without
 * touching the engine — capability grows by data, not branching.
 */
import type { EqfLevel } from "./types";

const EQF_MIN = 1;
const EQF_MAX = 8;

/** Runtime guard: is `n` a whole EQF level in range? */
export function isEqfLevel(n: number): n is EqfLevel {
  return Number.isInteger(n) && n >= EQF_MIN && n <= EQF_MAX;
}
