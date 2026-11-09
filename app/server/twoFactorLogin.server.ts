import { createCookieSessionStorage } from "react-router";
import { env } from "./env.server";
import { createAttemptLimiter } from "./loginThrottle.server";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n";

/**
 * The step between password and session (P2-12): after a right password for an account with
 * two-step verification, a short-lived signed cookie remembers who still owes a code. It is
 * not a session: `getUser` never reads it. It carries the `sessionVersion` of that moment, so
 * a password change or deactivation in between voids it.
 */
const PENDING_MS = 5 * 60_000;

const pendingStorage = createCookieSessionStorage<{
  userId: string;
  sessionVersion: number;
  startedAt: number;
}>({
  cookie: {
    name: "__2fa",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [env.SESSION_SECRET],
    maxAge: PENDING_MS / 1000,
    path: "/login",
  },
});

/** `Set-Cookie` for a pending code step of `userId`. */
export async function startPendingLogin(userId: string, sessionVersion: number): Promise<string> {
  const session = await pendingStorage.getSession();
  session.set("userId", userId);
  session.set("sessionVersion", sessionVersion);
  session.set("startedAt", Date.now());
  return pendingStorage.commitSession(session);
}

/** Who owes a code, or `null` without a pending step or after five minutes. */
export async function readPendingLogin(
  request: Request,
): Promise<{ userId: string; sessionVersion: number } | null> {
  const session = await pendingStorage.getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  const startedAt = session.get("startedAt");
  if (typeof userId !== "string" || typeof startedAt !== "number") return null;
  const age = Date.now() - startedAt;
  if (age < 0 || age > PENDING_MS) return null;
  return { userId, sessionVersion: session.get("sessionVersion") ?? 0 };
}

/** `Set-Cookie` that ends the pending step. */
export async function endPendingLogin(request: Request): Promise<string> {
  return pendingStorage.destroySession(
    await pendingStorage.getSession(request.headers.get("Cookie")),
  );
}

/**
 * Code guessing: 5 wrong codes for one account lock its code step for 15 minutes, doubling
 * up to a day, like wrong passwords (a six-digit code has a million options, so a lock is
 * what keeps guessing hopeless).
 */
const LOCKOUT_MS = 15 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
export const codeLimiter = createAttemptLimiter({
  maxFailures: 5,
  windowMs: LOCKOUT_MS,
  lockoutMs: LOCKOUT_MS,
  maxLockoutMs: DAY_MS,
  forgetAfterMs: DAY_MS,
});

/** "Too many attempts, try again in N minutes/hours", shared by both login steps. */
export function lockoutMessage(m: Messages, retryAfterMs: number): string {
  const minutes = Math.ceil(retryAfterMs / 60_000);
  if (minutes <= 60) return fmt(m.auth.tooManyAttempts, { minutes });
  return fmt(m.auth.tooManyAttemptsHours, { hours: Math.ceil(minutes / 60) });
}
