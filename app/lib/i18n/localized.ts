import type { Locale } from "./index";

/**
 * A piece of display text that is either language-neutral (a plain string) or
 * localized per UI locale. Used for registry/tool *content* (names, labels,
 * options, hints) so the catalog itself is bilingual, not Dutch-only.
 */
export type LocalizedText = string | Record<Locale, string>;

/** Resolve a LocalizedText to the active locale. Plain strings pass through. */
export function loc(value: LocalizedText | undefined | null, locale: Locale): string {
  if (value == null) return "";
  return typeof value === "string" ? value : value[locale];
}
