/**
 * Baseline HTTP security headers on every response the app produces: rendered
 * pages (entry.server) and, through the root route's middleware, data requests
 * and resource routes (`/api/*`, exports, prints, `/healthz`). Kept as pure data
 * plus small appliers so it is unit-testable without spinning up SSR.
 *
 * Static build assets (`/assets/*`) are served by react-router-serve's static
 * middleware before the app runs; they carry no user content.
 */
import { createContext, type MiddlewareFunction, type RouterContextProvider } from "react-router";

/**
 * Content Security Policy — **enforcing**, verified clean in the browser. Notes on the sources:
 *  - Scripts: our own origin plus inline scripts that carry this request's nonce (P2). React
 *    Router's hydration scripts and React's streaming scripts get the nonce through
 *    entry.server (`<ServerRouter nonce>`, `renderToPipeableStream({ nonce })`); an injected
 *    inline script has no nonce and is refused. No `'unsafe-inline'` for scripts any more.
 *  - Fonts are self-hosted (`public/fonts/`, `@font-face` in `app.css`) →
 *    `font-src 'self'`, and styles come only from our own origin. Styles keep
 *    `'unsafe-inline'`: React renders `style` attributes, which a nonce cannot cover.
 *  - Uploaded image previews are `data:`/`blob:` URLs.
 *  - The SSE stream + feedback POST are same-origin fetches → `connect-src 'self'`.
 *  - `frame-ancestors`, `base-uri`, `form-action` and `object-src` do not fall
 *    back to `default-src`, so they are set explicitly.
 */
export function contentSecurityPolicy(nonce: string | null = null): string {
  return [
    "default-src 'self'",
    nonce ? `script-src 'self' 'nonce-${nonce}'` : "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The policy without a nonce: no inline script at all (API, exports, redirects). */
export const CSP = contentSecurityPolicy();

/** 128 random bits, base64: a new one for every request, never reused. */
export function createCspNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}

/** The current request's CSP nonce, set by the root middleware before anything renders. */
export const cspNonceContext = createContext<string | null>(null);

export function cspNonceOf(context: Pick<RouterContextProvider, "get"> | undefined): string | null {
  return context?.get(cspNonceContext) ?? null;
}

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

type Options = { production?: boolean; nonce?: string | null };

const isProduction = () => process.env.NODE_ENV === "production";

/** Set every baseline security header onto an outgoing response's Headers. */
export function applySecurityHeaders(
  headers: Headers,
  { production = isProduction(), nonce = null }: Options = {},
): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  if (nonce) headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
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

/**
 * Root-route middleware: every matched request (page, data, resource route). It picks the
 * request's CSP nonce first, so the page render inside `next()` (entry.server) stamps the same
 * nonce on its scripts that the header allows.
 */
export const securityHeadersMiddleware: MiddlewareFunction<Response> = async (
  { context },
  next,
) => {
  const nonce = createCspNonce();
  context.set(cspNonceContext, nonce);
  return withSecurityHeaders(await next(), { nonce });
};
