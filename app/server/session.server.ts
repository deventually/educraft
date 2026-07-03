import { createCookieSessionStorage } from "react-router";
import { env } from "./env.server";

/**
 * Cookie-backed sessions (no server-side session store needed at this scale).
 * The cookie carries only `{ userId }` — the role is always read fresh from the
 * DB in `auth.server`, so a role change takes effect without re-login.
 */
export const sessionStorage = createCookieSessionStorage<{ userId: string }>({
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
