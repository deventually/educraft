import { createCookieSessionStorage, type MiddlewareFunction } from "react-router";
import { env } from "./env.server";

/** A session ends after 8 hours without a request (P1-4, sliding). */
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;

/**
 * An active session's cookie is re-issued at most once per this interval, so not
 * every request carries a Set-Cookie. The effective idle timeout is therefore
 * between 7 h 55 min and 8 h.
 */
export const SESSION_REFRESH_AFTER_MS = 5 * 60 * 1000;

const COOKIE_NAME = "__session";

/**
 * Cookie-backed sessions (no server-side session store needed at this scale).
 * The cookie carries `{ userId, sessionVersion, lastSeen }` — the role is always read
 * fresh from the DB in `auth.server`, so a role change takes effect without re-login.
 *
 * `lastSeen` (epoch ms) makes the timeout sliding: `getUser` refuses a session idle for
 * longer than `SESSION_IDLE_MS`, and `sessionRefreshMiddleware` re-stamps it on activity.
 * The cookie's own Max-Age matches, so the browser drops it too; the server-side check
 * is what counts, because a copied cookie ignores Max-Age.
 *
 * `sessionVersion` is the "log out other devices" switch: it is bumped ONLY when the
 * password changes (reset link, `/account`, the owner setting one), the owner
 * deactivates the account (`setUserDisabled`), a real role change (`setUserRole`) or
 * the person chooses "log out everywhere" on `/account` (`logOutEverywhere`), and it
 * is compared against `users.sessionVersion`. A plain login does not bump it, so one
 * person can be signed in on several devices at once.
 */
export const sessionStorage = createCookieSessionStorage<{
  userId: string;
  sessionVersion: number;
  lastSeen: number;
}>({
  cookie: {
    name: COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [env.SESSION_SECRET],
    maxAge: SESSION_IDLE_MS / 1000, // 8 hours, renewed on activity
    path: "/",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;

/**
 * Whether a session last seen at `lastSeen` is still within the idle window. A
 * session without a (valid) stamp — minted before P1-4 — counts as expired.
 */
export function isSessionFresh(lastSeen: unknown, now = Date.now()): boolean {
  if (typeof lastSeen !== "number" || !Number.isFinite(lastSeen)) return false;
  const idle = now - lastSeen;
  return idle >= 0 && idle <= SESSION_IDLE_MS;
}

/** The response with `Set-Cookie` appended; an immutable one is copied first. */
function withSetCookie(response: Response, cookie: string): Response {
  try {
    response.headers.append("Set-Cookie", cookie);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    copy.headers.append("Set-Cookie", cookie);
    return copy;
  }
}

/**
 * Root-route middleware: every request with a still-fresh session counts as activity
 * and slides the 8-hour window, at most once per `SESSION_REFRESH_AFTER_MS`. It never
 * revives an expired session and never overrides a session cookie the route set itself
 * (login, logout, a new password). It reads only the cookie, no database: a refreshed
 * cookie keeps its `userId` and `sessionVersion`, which `getUser` still checks.
 */
export const sessionRefreshMiddleware: MiddlewareFunction<Response> = async ({ request }, next) => {
  const response = await next();
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader?.includes(`${COOKIE_NAME}=`)) return response;
  const session = await getSession(cookieHeader);
  if (!session.get("userId")) return response;
  const lastSeen = session.get("lastSeen");
  const now = Date.now();
  if (!isSessionFresh(lastSeen, now)) return response;
  if (now - (lastSeen as number) < SESSION_REFRESH_AFTER_MS) return response;
  if (response.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_NAME}=`))) {
    return response;
  }
  session.set("lastSeen", now);
  return withSetCookie(response, await commitSession(session));
};
