import { createCookie, redirect } from "react-router";
import { env } from "./env.server";
import { FlashSchema, type Flash, type FlashKey } from "~/lib/flash";

/**
 * One-shot flash cookie (P16). Separate from the session cookie, so a flash
 * survives `logout` (which destroys the session) and never touches auth.
 * Signed, HttpOnly, and short-lived: it only has to outlive one redirect.
 */
const flashCookie = createCookie("__flash", {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  secrets: [env.SESSION_SECRET],
  maxAge: 60,
  path: "/",
});

/** `Set-Cookie` header value that carries `key` to the next page. */
export async function setFlash(key: FlashKey): Promise<string> {
  return flashCookie.serialize({ key, id: crypto.randomUUID() });
}

/**
 * Read the flash and the header that clears it (read once, so a refresh does
 * not toast again). A forged or unknown flash is dropped but still cleared.
 */
export async function takeFlash(
  request: Request,
): Promise<{ flash: Flash | null; clearCookie: string | null }> {
  const header = request.headers.get("Cookie");
  if (!header || !/(?:^|;\s*)__flash=/.test(header)) return { flash: null, clearCookie: null };
  // `parse` yields null for a bad signature; the schema drops anything else unknown.
  const parsed = FlashSchema.safeParse(await flashCookie.parse(header));
  return {
    flash: parsed.success ? parsed.data : null,
    clearCookie: await flashCookie.serialize("", { maxAge: 0 }),
  };
}

/** `redirect(url)` with a flash, keeping any other `Set-Cookie` in `init`. */
export async function redirectWithFlash(
  url: string,
  key: FlashKey,
  init?: { headers?: HeadersInit },
): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.append("Set-Cookie", await setFlash(key));
  return redirect(url, { headers });
}
