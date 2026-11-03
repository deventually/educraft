import { redirect } from "react-router";
import { commitSession, destroySession, getSession } from "./session.server";
import { getUserById } from "./repositories/users.server";
import { getOwnerUserId } from "./repositories/settings.server";
import type { UserRow } from "./schema.server";
import { isRole, type Role } from "~/lib/registry/access";

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
  const row = await getUserById(userId);
  if (!row) return null;
  // A legacy row with a retired role (e.g. "student", pre-P17 data) counts as logged out.
  if (!isRole(row.role)) return null;
  // A cookie whose sessionVersion is behind the stored one predates a password
  // change → treat as logged out on that device.
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

/** Require one of `roles`; throw a 403 Response otherwise. */
export async function requireRole(request: Request, ...roles: Role[]): Promise<User> {
  const user = await requireUser(request);
  if (!roles.includes(user.role)) throw new Response("Forbidden", { status: 403 });
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
  return commitSession(session);
}

/**
 * Create a session for `userId` and redirect to `redirectTo`. Logging in does not
 * touch other sessions: the same account may be signed in on several devices.
 */
export async function createUserSession(userId: string, redirectTo: string): Promise<Response> {
  return redirect(redirectTo, { headers: { "Set-Cookie": await sessionCookie(userId) } });
}

/**
 * `Set-Cookie` header value for a fresh session of `userId`. Used after a password
 * change: the change bumps `sessionVersion` (logging out every other device), so the
 * device that made the change needs a re-issued cookie to stay signed in.
 */
export async function reissueSessionCookie(userId: string): Promise<string> {
  return sessionCookie(userId);
}

/** Destroy the session and redirect to /login. */
export async function logout(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
