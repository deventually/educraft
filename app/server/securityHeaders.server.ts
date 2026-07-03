/**
 * Baseline HTTP security headers applied to every rendered response (see
 * entry.server). Kept as pure data + a small applier so it is unit-testable
 * without spinning up SSR.
 */

/**
 * Content Security Policy — shipped **report-only** until verified in the browser
 * (Phase 2 deploy checklist flips it to enforcing). Notes on the sources:
 *  - `root.tsx` loads Google Fonts → googleapis (styles) + gstatic (fonts).
 *  - React Router injects inline hydration scripts → `script-src 'unsafe-inline'`
 *    (tightening to nonces is out of scope for Phase 0).
 *  - Uploaded image previews are `data:`/`blob:` URLs.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY,
};

/** Set every baseline security header onto an outgoing response's Headers. */
export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
}
