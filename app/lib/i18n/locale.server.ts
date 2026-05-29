import { DEFAULT_LOCALE, isLocale, type Locale } from "./index";

const COOKIE_NAME = "lang";

/** Read the UI locale from the request's `lang` cookie, defaulting to Dutch. */
export function getLocale(request: Request): Locale {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`).exec(cookie);
  const value = match?.[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Build a persistent Set-Cookie value pinning the UI locale for one year. */
export function localeSetCookie(locale: Locale): string {
  return `${COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
