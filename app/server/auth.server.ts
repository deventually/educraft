import { redirect } from "react-router";
import { commitSession, destroySession, getSession } from "./session.server";
import { getUserById } from "./repositories/users.server";
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
  return row ? toPublicUser(row) : null;
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

/** Create a session for `userId` and redirect to `redirectTo`. */
export async function createUserSession(userId: string, redirectTo: string): Promise<Response> {
  const session = await getSession();
  session.set("userId", userId);
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
