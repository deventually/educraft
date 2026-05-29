import { useRouteLoaderData } from "react-router";
import { DEFAULT_LOCALE, getMessages, type Locale, type Messages } from "./index";

/** Current UI locale, resolved from the root loader (falls back to Dutch). */
export function useLocale(): Locale {
  const data = useRouteLoaderData("root") as { locale?: Locale } | undefined;
  return data?.locale ?? DEFAULT_LOCALE;
}

/** Localized message bundle for the active UI locale. */
export function useT(): Messages {
  return getMessages(useLocale());
}
