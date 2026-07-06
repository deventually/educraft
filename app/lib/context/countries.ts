/**
 * Country seam (Phase 8) — the outermost axis of the teaching context. Today the
 * catalogue holds only the Netherlands; the shape exists so a future country pack
 * slots in as pure data (its own sectors, national framework and domain packs)
 * without touching the engine. The engine itself stays country-neutral: `country`
 * only selects which national data to read (level framework, domain packs), never
 * a branch in the prompt pipeline.
 */
import type { LocalizedText } from "~/lib/i18n/localized";

export const COUNTRIES = ["NL"] as const;
export type CountryCode = (typeof COUNTRIES)[number];

/** The one country shipped today; also the read-time migration backfill. */
export const DEFAULT_COUNTRY: CountryCode = "NL";

export const COUNTRY_LABELS: Record<CountryCode, LocalizedText> = {
  NL: { nl: "Nederland", en: "Netherlands" },
};

/** Runtime guard: is `s` a shipped country code? */
export function isCountryCode(s: string): s is CountryCode {
  return (COUNTRIES as readonly string[]).includes(s);
}
