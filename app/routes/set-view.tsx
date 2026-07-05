import { redirect } from "react-router";
import type { Route } from "./+types/set-view";
import { requireUser } from "~/server/auth.server";
import { viewAsSetCookie } from "~/server/roleView.server";

/**
 * Resource route (no UI): an admin toggles "view as teacher" (and back), then is
 * redirected to where they came from. Posted to by the role switch in AppShell.
 * Only admins can meaningfully set it — a non-admin's choice is ignored, since
 * `getEffectiveRole` never raises privilege.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const requested = String(form.get("view") ?? "");
  const view = requested === "teacher" && user.role === "admin" ? "teacher" : "admin";
  const redirectTo = safeRedirect(String(form.get("redirectTo") ?? "/"));
  return redirect(redirectTo, { headers: { "Set-Cookie": viewAsSetCookie(view) } });
}

/** Only allow same-app relative redirects (no protocol-relative or absolute URLs). */
function safeRedirect(to: string): string {
  return to.startsWith("/") && !to.startsWith("//") ? to : "/";
}
