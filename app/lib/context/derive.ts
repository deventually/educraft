/**
 * Level derivation (Phase 8) — the single seam that turns a profile's stored
 * level into the country-neutral EQF the engine injects. It prefers the national
 * (NLQF) level and falls back to a legacy `eqf`, so legacy profiles saved before
 * the national-level field existed keep working untouched.
 *
 * Everything downstream (format.ts) reads only `{ eqf, entryLevel }`, never the
 * national level — that is what keeps the prompt pipeline country-neutral.
 */
import type { EqfLevel } from "./types";
import type { NlqfLevel } from "./nlqf";
import { nlqfToEqf } from "./nlqf";

export interface ResolvedLevel {
  eqf: EqfLevel;
  /** True only for the Instroomniveau approximation — pairs with a neutral note. */
  entryLevel: boolean;
}

/** The level-bearing fields — a full ContextProfile or a bare `{ eqf }`. */
export interface LevelInput {
  nationalLevel?: NlqfLevel;
  eqf?: EqfLevel;
}

/**
 * Resolve a profile's level to `{ eqf, entryLevel }`, or undefined when no level
 * is set. Prefers `nationalLevel` (via `nlqfToEqf`); otherwise the bare `eqf`.
 */
export function resolveLevel(profile: LevelInput): ResolvedLevel | undefined {
  if (profile.nationalLevel) return nlqfToEqf(profile.nationalLevel);
  if (profile.eqf) return { eqf: profile.eqf, entryLevel: false };
  return undefined;
}
