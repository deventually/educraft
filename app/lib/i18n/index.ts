import { nl, type Messages } from "./messages/nl";
import { en } from "./messages/en";

export type { Messages };

/** Supported UI locales. Dutch is the default; English mirrors it 1:1. */
export const LOCALES = ["nl", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "nl";

export const messages: Record<Locale, Messages> = { nl, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Resolve a (possibly untrusted) locale code to its message bundle. */
export function getMessages(locale: string | null | undefined): Messages {
  return isLocale(locale) ? messages[locale] : messages[DEFAULT_LOCALE];
}
