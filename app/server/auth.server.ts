import { redirect } from "react-router";
import { commitSession, destroySession, getSession, isSessionFresh } from "./session.server";
import { getUserById } from "./repositories/users.server";
import { getOwnerUserId } from "./repositories/settings.server";
import { isTwoFactorEnabled } from "./repositories/twoFactor.server";
import type { UserRow } from "./schema.server";
import { isRole, type Role } from "~/lib/registry/access";
import type { FlashKey } from "~/lib/flash";
import { redirectWithFlash } from "./flash.server";

/**
 * The public user shape passed to loaders/components — the password hash never
 * leaves the server boundary. Role is always resolved fresh from the DB (the
 * session only stores `userId`), so a role change takes effect immediately.
 */
export interface User {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  createdAt: Date;
}

function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    createdAt: row.createdAt,
  };
}

/** Resolve the authenticated user from the session cookie, or null. */
export async function getUser(request: Request): Promise<User | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId || typeof userId !== "string") return null;
  // Idle for more than 8 hours (P1-4), or minted before the stamp existed → logged out.
  if (!isSessionFresh(session.get("lastSeen"))) return null;
  const row = await getUserById(userId);
  if (!row) return null;
  // A legacy row with a retired role (e.g. "student", pre-P17 data) counts as logged out.
  if (!isRole(row.role)) return null;
  // A deactivated account (P18.7) has no session at all; its data stays.
  if (row.disabledAt) return null;
  // A cookie whose sessionVersion is behind the stored one predates a password
  // change, a deactivation, a role change or "log out everywhere" → logged out.
  const cookieVersion = session.get("sessionVersion") ?? 0;
  if ((row.sessionVersion ?? 0) !== cookieVersion) return null;
  return toPublicUser(row);
}

/** Require an authenticated user; throw a redirect to /login otherwise. */
export async function requireUser(request: Request): Promise<User> {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  return user;
}

/**
 * Require one of `roles`; throw a 403 Response otherwise. An admin-only page also needs
 * two-step verification (P2-12): an admin without it is sent to set it up first.
 */
export async function requireRole(request: Request, ...roles: Role[]): Promise<User> {
  const user = await requireUser(request);
  if (!roles.includes(user.role)) throw new Response("Forbidden", { status: 403 });
  if (!roles.includes("teacher") && !(await isTwoFactorEnabled(user.id))) {
    throw redirect("/account/2fa");
  }
  return user;
}

/**
 * Whether `user` is the super admin (P18.6): an admin whose id is the stored
 * `ownerUserId`. Callers pass the user from `requireRole`/`getUser`, whose role is
 * resolved fresh from the DB, so a stored id of a demoted user counts as no owner.
 * Every owner-only authority check goes through this, server-side, in the action.
 */
export async function isOwner(user: Pick<User, "id" | "role">): Promise<boolean> {
  return user.role === "admin" && (await getOwnerUserId()) === user.id;
}

/** Mint a session cookie carrying the user's current `sessionVersion` (no bump). */
async function sessionCookie(userId: string): Promise<string> {
  const row = await getUserById(userId);
  const session = await getSession();
  session.set("userId", userId);
  session.set("sessionVersion", row?.sessionVersion ?? 0);
  session.set("lastSeen", Date.now());
  return commitSession(session);
}

/**
 * Create a session for `userId` and redirect to `redirectTo`, optionally with a
 * flash toast for the landing page (P16). Logging in does not touch other
 * sessions: the same account may be signed in on several devices.
 */
export async function createUserSession(
  userId: string,
  redirectTo: string,
  flash?: FlashKey,
): Promise<Response> {
  const headers = { "Set-Cookie": await sessionCookie(userId) };
  return flash
    ? redirectWithFlash(redirectTo, flash, { headers })
    : redirect(redirectTo, { headers });
}

/**
 * `Set-Cookie` header value for a fresh session of `userId`. Used after a password
 * change: the change bumps `sessionVersion` (logging out every other device), so the
 * device that made the change needs a re-issued cookie to stay signed in.
 */
export async function reissueSessionCookie(userId: string): Promise<string> {
  return sessionCookie(userId);
}

/** Destroy the session and redirect to /login, optionally with a flash toast (P16). */
export async function logout(request: Request, flash?: FlashKey): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  const headers = { "Set-Cookie": await destroySession(session) };
  return flash ? redirectWithFlash("/login", flash, { headers }) : redirect("/login", { headers });
}
