import { redirect } from "react-router";
import { commitSession, destroySession, getSession } from "./session.server";
import { bumpSessionVersion, getUserById } from "./repositories/users.server";
import type { UserRow } from "./schema.server";
import type { Role } from "~/lib/registry/access";

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
  // Single active session (Phase 6): a cookie whose sessionVersion is behind the
  // stored one was invalidated by a newer login → treat as logged out.
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
 * Create a session for `userId` and redirect to `redirectTo`. Bumps the user's
 * `sessionVersion` first and writes it into the cookie, so this login invalidates
 * any older cookie (single active session, Phase 6).
 */
export async function createUserSession(userId: string, redirectTo: string): Promise<Response> {
  const sessionVersion = await bumpSessionVersion(userId);
  const session = await getSession();
  session.set("userId", userId);
  session.set("sessionVersion", sessionVersion);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

/** Destroy the session and redirect to /login. */
export async function logout(request: Request): Promise<Response> {
  const session = await getSession(request.headers.get("Cookie"));
  return redirect("/login", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
