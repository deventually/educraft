/**
 * Domain packs — the verified, structured field sets for each hbo domain.
 *
 * This is the seam that keeps the engine neutral: capability grows by adding
 * data here, never by branching control flow. Each pack's option values are
 * lifted verbatim from the domain's authoritative national framework (see
 * `source`/`sourceUrl`). Domains WITHOUT a recognised national taxonomy are
 * deliberately absent — the UI falls back to user-defined custom fields rather
 * than inventing a framework.
 *
 * A profile stores only the chosen values (`ContextProfile.packValues`), keyed
 * by `PackField.key`; labels + options are resolved from here for both the
 * settings UI and the prompt context formatter.
 */
import type { LocalizedText } from "~/lib/i18n/localized";
import type { HboDomain, PackFieldValue } from "./types";
import { TECH_BUSINESS_PACKS } from "./packsTechBusiness";
import { CARE_SOCIETY_PACKS } from "./packsCareSociety";

export type PackFieldType = "multiselect" | "single-select" | "level";

export interface PackOption {
  /** Stable, stored value (canonical Dutch term). */
  value: string;
  label: LocalizedText;
}

export interface PackField {
  /** Stable key; used in `packValues` and as the form input name `pack.<key>`. */
  key: string;
  label: LocalizedText;
  type: PackFieldType;
  /** Options for "multiselect" / "single-select". */
  options?: PackOption[];
  /** Highest level for "level" (scale 1..levelMax). */
  levelMax?: number;
  /** Short hint shown under the field. */
  help?: LocalizedText;
}

export interface DomainPack {
  /** Framework name (shown to the user for transparency). */
  source: LocalizedText;
  /** Link to the authoritative source document. */
  sourceUrl?: string;
  fields: PackField[];
}

/**
 * Verified packs per domain. Keys are exactly the `HBO_DOMAINS` values.
 * Domains with no entry have no national taxonomy → custom fields only.
 */
export const DOMAIN_PACKS: Partial<Record<HboDomain, DomainPack>> = {
  ...TECH_BUSINESS_PACKS,
  ...CARE_SOCIETY_PACKS,
  // Agro, voeding & leefomgeving + Overig: no national taxonomy → custom fields only.
};

/** The pack for a domain, or undefined if the domain has no structured framework. */
export function getDomainPack(domain: string | undefined | null): DomainPack | undefined {
  if (!domain) return undefined;
  return DOMAIN_PACKS[domain as HboDomain];
}

/** A pack field by key within a domain (for parsing/formatting lookups). */
export function getPackField(domain: string | undefined, key: string): PackField | undefined {
  return getDomainPack(domain)?.fields.find((f) => f.key === key);
}

/**
 * A suggested mastery level for a 4-year hbo bachelor by study year. The
 * frameworks (hbo-i, HBO Engineering) define the TOP level (`levelMax`, here 3)
 * as the bachelor graduation ceiling and treat the propedeuse as the entry
 * level; the middle years build toward it. OERs publish only the propedeuse and
 * graduation milestones, so the year-2/3 placement is a transparent
 * interpolation, not a single cited figure — and the user can change it.
 * Returns undefined when no year is chosen (then nothing is prefilled).
 */
export function levelForYear(year: number | undefined, levelMax: number): number | undefined {
  if (!year) return undefined;
  const byYear: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: levelMax };
  const lvl = byYear[year];
  return lvl == null ? undefined : Math.min(lvl, levelMax);
}

/**
 * Factual default answers for a pack (resolve it with `resolveFramework`), used
 * to PRE-FILL the create form:
 * - multiselect dimensions → left EMPTY. The framework lists the domain's whole
 *   competence set, but a course only touches a few of those dimensions. Pre-
 *   selecting every option injects the undifferentiated taxonomy into every
 *   prompt — noise that carries no discriminating signal and drowns the genuinely
 *   informative free-text fields. The user picks the few their course emphasises.
 * - level → `levelForYear` once a study year is chosen (single low-noise value).
 * - single-select → left unset (no factual default among the alternatives).
 */
export function defaultPackValues(
  pack: DomainPack | undefined,
  studyYear?: number,
): Record<string, PackFieldValue> {
  if (!pack) return {};
  const out: Record<string, PackFieldValue> = {};
  for (const field of pack.fields) {
    if (field.type === "level") {
      const lvl = levelForYear(studyYear, field.levelMax ?? 3);
      if (lvl != null) out[field.key] = lvl;
    }
  }
  return out;
}
