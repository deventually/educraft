import type { Role } from "~/lib/registry/access";
import type { User } from "./auth.server";

/**
 * "View as" (Phase 4). An admin is a superset of a teacher, so the only sensible
 * role switch is an admin *downshifting* to experience the app as a teacher would
 * (teacher tool set, no admin chrome) and back. The choice lives in a cookie so
 * it survives navigation; it can only ever LOWER privilege, never raise it — a
 * teacher setting it is a no-op, and nobody can grant themselves admin this way.
 */
const COOKIE_NAME = "viewAs";

/** The raw cookie value, or null. */
function readCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`).exec(cookie);
  return match?.[1] ?? null;
}

/** Whether an admin has chosen to view the app as a teacher. */
export function isViewingAsTeacher(request: Request): boolean {
  return readCookie(request) === "teacher";
}

/**
 * The role that should drive the *experience* (tool availability, nav). Equals
 * the real role, except an admin who chose "view as teacher" is treated as a
 * teacher. Never exceeds the real role.
 */
export function getEffectiveRole(user: Pick<User, "role">, request: Request): Role {
  if (user.role === "admin" && isViewingAsTeacher(request)) return "teacher";
  return user.role;
}

/** Build the Set-Cookie that pins (or clears) the view-as choice. */
export function viewAsSetCookie(view: "teacher" | "admin"): string {
  // "admin" = back to the real role → expire the cookie.
  return view === "teacher"
    ? `${COOKIE_NAME}=teacher; Path=/; Max-Age=31536000; SameSite=Lax`
    : `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
