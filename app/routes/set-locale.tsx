import { redirect } from "react-router";
import type { Route } from "./+types/set-locale";
import { DEFAULT_LOCALE, isLocale } from "~/lib/i18n";
import { localeSetCookie } from "~/lib/i18n/locale.server";

/**
 * Resource route (no UI) that persists the chosen UI locale in a cookie and
 * redirects back to the page the user came from. Posted to by the language
 * switcher in AppShell.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const requested = String(form.get("locale") ?? "");
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;
  const redirectTo = safeRedirect(String(form.get("redirectTo") ?? "/"));
  return redirect(redirectTo, { headers: { "Set-Cookie": localeSetCookie(locale) } });
}

/** Only allow same-app relative redirects (no protocol-relative or absolute URLs). */
function safeRedirect(to: string): string {
  return to.startsWith("/") && !to.startsWith("//") ? to : "/";
}
