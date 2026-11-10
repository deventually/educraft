// Signs a test in for real: a user in the in-memory database and a session cookie that the real
// `auth.server` guard accepts. No `vi.mock("~/server/auth.server")`, so the file can run shared.
import { commitSession, getSession } from "~/server/session.server";
import { createUser, getUserById } from "~/server/repositories/users.server";
import { confirmTwoFactorSetup, startTwoFactorSetup } from "~/server/repositories/twoFactor.server";
import { totpCode } from "~/server/totp.server";
import type { Role } from "~/lib/registry/access";

export interface TestUser {
  id: string;
  role?: Role;
  name?: string;
  email?: string | null;
  /** An admin gets two-step verification unless this is false (admin pages need it). */
  twoFactor?: boolean;
}

async function turnOnTwoFactor(userId: string): Promise<void> {
  const secret = await startTwoFactorSetup(userId);
  if (secret === null) return; // already on
  await confirmTwoFactorSetup(userId, totpCode(secret, Math.floor(Date.now() / 30_000)));
}

/** The `Cookie` value of a fresh session for `user`, created first when it does not exist. */
export async function signIn(user: TestUser): Promise<string> {
  const role = user.role ?? "teacher";
  const row =
    (await getUserById(user.id)) ??
    (await createUser({
      id: user.id,
      name: user.name ?? user.id,
      email: user.email ?? null,
      passwordHash: "scrypt:test:test",
      role,
    }));
  if (row.role === "admin" && user.twoFactor !== false) await turnOnTwoFactor(row.id);
  const session = await getSession();
  session.set("userId", row.id);
  session.set("sessionVersion", row.sessionVersion ?? 0);
  session.set("lastSeen", Date.now());
  return (await commitSession(session)).split(";")[0] ?? "";
}

/** `request` with the session cookie added to any cookie it already has. */
export function withCookie(request: Request, cookie: string): Request {
  const headers = new Headers(request.headers);
  const existing = headers.get("cookie");
  headers.set("cookie", existing ? `${existing}; ${cookie}` : cookie);
  return new Request(request, { headers });
}

/** The session `signedRequest` sends: the user signed in last with `signInAs`, or none. */
let current = "";

/** Sign `user` in for every following `signedRequest` (the "current user" of a test file). */
export async function signInAs(user: TestUser): Promise<void> {
  current = await signIn(user);
}

/** Send the following `signedRequest`s without a session. */
export function signOut(): void {
  current = "";
}

/** `new Request(input, init)` as the user signed in with `signInAs`. */
export function signedRequest(input: string, init?: RequestInit): Request {
  const request = new Request(input, init);
  return current ? withCookie(request, current) : request;
}
