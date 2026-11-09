const PROBE_ORIGIN = "http://safe-redirect.invalid";

function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Only allow redirects to a path inside this app. Anything else, including tricks
 * that browsers resolve to another origin (`//evil.com`, `/\evil.com`, a tab or
 * newline the URL parser strips), falls back to `fallback`.
 */
export function safeRedirect(to: unknown, fallback = "/"): string {
  if (typeof to !== "string") return fallback;
  if (!to.startsWith("/") || to.startsWith("//")) return fallback;
  if (to.includes("\\") || hasControlChar(to)) return fallback;
  try {
    if (new URL(to, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return to;
}
