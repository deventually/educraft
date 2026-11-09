/**
 * Baseline HTTP security headers on every response the app produces: rendered
 * pages (entry.server) and, through the root route's middleware, data requests
 * and resource routes (`/api/*`, exports, prints, `/healthz`). Kept as pure data
 * plus small appliers so it is unit-testable without spinning up SSR.
 *
 * Static build assets (`/assets/*`) are served by react-router-serve's static
 * middleware before the app runs; they carry no user content.
 */
import type { MiddlewareFunction } from "react-router";

/**
 * Content Security Policy — **enforcing**. Shipped report-only in Phase 0, then
 * verified in the browser during the P2 deploy click-through (all app surfaces
 * loaded + a live generation and feedback submit produced zero CSP violations)
 * and flipped to enforcing. Notes on the sources:
 *  - Fonts are self-hosted (`public/fonts/`, `@font-face` in `app.css`) →
 *    `font-src 'self'`, and styles come only from our own origin.
 *  - React Router injects inline hydration scripts → `script-src 'unsafe-inline'`
 *    (tightening to nonces is a later hardening step).
 *  - Uploaded image previews are `data:`/`blob:` URLs.
 *  - The SSE stream + feedback POST are same-origin fetches → `connect-src 'self'`.
 *  - `frame-ancestors`, `base-uri`, `form-action` and `object-src` do not fall
 *    back to `default-src`, so they are set explicitly.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // microphone: dictation, only for LimeOnIt itself.
  "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
  "Content-Security-Policy": CSP,
};

/**
 * HTTPS only, for a year. Production only: dev runs on plain http://localhost.
 * No `includeSubDomains`: other hosts on the school's domain are not ours to pin.
 */
export const HSTS = "max-age=31536000";

type Options = { production?: boolean };

const isProduction = () => process.env.NODE_ENV === "production";

/** Set every baseline security header onto an outgoing response's Headers. */
export function applySecurityHeaders(
  headers: Headers,
  { production = isProduction() }: Options = {},
): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  if (production) headers.set("Strict-Transport-Security", HSTS);
}

/**
 * The response with the security headers set. A response whose headers are
 * immutable (`Response.redirect`, a proxied `fetch`) is copied first.
 */
export function withSecurityHeaders(response: Response, options: Options = {}): Response {
  try {
    applySecurityHeaders(response.headers, options);
    return response;
  } catch {
    const copy = new Response(response.body, response);
    applySecurityHeaders(copy.headers, options);
    return copy;
  }
}

/** Root-route middleware: every matched request (page, data, resource route). */
export const securityHeadersMiddleware: MiddlewareFunction<Response> = async (_args, next) =>
  withSecurityHeaders(await next());
