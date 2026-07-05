import { createCookieSessionStorage } from "react-router";
import { env } from "./env.server";

/**
 * Cookie-backed sessions (no server-side session store needed at this scale).
 * The cookie carries `{ userId, sessionVersion }` — the role is always read fresh
 * from the DB in `auth.server`, so a role change takes effect without re-login.
 * `sessionVersion` backs single-active-session anti-sharing (Phase 6): it is
 * bumped on every login/redeem and compared against `users.sessionVersion`.
 */
export const sessionStorage = createCookieSessionStorage<{
  userId: string;
  sessionVersion: number;
}>({
  cookie: {
    name: "__session",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    secrets: [env.SESSION_SECRET],
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
