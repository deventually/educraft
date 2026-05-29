import type { Locale } from "./index";

/**
 * An error whose message is meant to be shown to the user, carrying a variant
 * per UI locale. Thrown by code paths that surface to the result panel (e.g. a
 * missing API key, an unavailable CLI agent). The `Error.message` defaults to
 * the English variant for server logs. Pure-internal/dev errors should stay as
 * plain `Error` with an English message — they signal bugs, not user situations.
 */
export class LocalizedError extends Error {
  readonly messages: Record<Locale, string>;
  constructor(messages: Record<Locale, string>) {
    super(messages.en);
    this.name = "LocalizedError";
    this.messages = messages;
  }
}

/**
 * Resolve any thrown value to a user-facing string in `locale`: a LocalizedError
 * is shown in that locale; a plain Error passes its (English) message through;
 * anything else falls back to `fallback`.
 */
export function localizeError(err: unknown, locale: Locale, fallback: string): string {
  if (err instanceof LocalizedError) return err.messages[locale];
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
