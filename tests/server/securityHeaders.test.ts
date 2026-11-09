import { describe, it, expect } from "vitest";
import { RouterContextProvider } from "react-router";
import {
  SECURITY_HEADERS,
  CSP,
  HSTS,
  applySecurityHeaders,
  contentSecurityPolicy,
  createCspNonce,
  cspNonceOf,
  securityHeadersMiddleware,
  withSecurityHeaders,
} from "~/server/securityHeaders.server";

/** The `script-src` directive of a policy. */
const scriptSrc = (policy: string) =>
  policy.split("; ").find((directive) => directive.startsWith("script-src "));

describe("security headers", () => {
  it("sets the standard hardening headers", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    // The microphone only for LimeOnIt itself (dictation), never for an embedded frame.
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBe(
      "camera=(), microphone=(self), geolocation=()",
    );
  });

  it("ships the CSP as enforcing (verified clean in the browser, P2 deploy)", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toBe(CSP);
    expect(SECURITY_HEADERS["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("allows only our own origin for styles and fonts (fonts are self-hosted)", () => {
    expect(CSP).not.toContain("fonts.googleapis.com");
    expect(CSP).not.toContain("fonts.gstatic.com");
    expect(CSP).toContain("style-src 'self' 'unsafe-inline';");
    expect(CSP).toContain("font-src 'self';");
    expect(CSP).toContain("default-src 'self'");
    // Images may be data:/blob: (uploaded page previews).
    expect(CSP).toContain("img-src 'self' data: blob:");
  });

  it("allows no inline script without a nonce", () => {
    expect(scriptSrc(CSP)).toBe("script-src 'self'");
    expect(scriptSrc(CSP)).not.toContain("'unsafe-inline'");
  });

  it("allows exactly the inline scripts that carry this request's nonce", () => {
    const policy = contentSecurityPolicy("abc123");
    expect(scriptSrc(policy)).toBe("script-src 'self' 'nonce-abc123'");
    // Everything else stays the same as the nonce-less policy.
    expect(policy.replace(" 'nonce-abc123'", "")).toBe(CSP);
  });

  it("closes the CSP gaps default-src does not cover", () => {
    // Nobody may frame LimeOnIt (the CSP twin of X-Frame-Options).
    expect(CSP).toContain("frame-ancestors 'none'");
    // No injected <base> may redirect relative URLs, no form may post off-site.
    expect(CSP).toContain("base-uri 'self'");
    expect(CSP).toContain("form-action 'self'");
    expect(CSP).toContain("object-src 'none'");
  });

  it("applies every header onto a Headers object", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { production: false });
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers.get(key)).toBe(value);
    }
  });

  it("adds HSTS only in production (dev runs on plain http://localhost)", () => {
    const prod = new Headers();
    applySecurityHeaders(prod, { production: true });
    expect(prod.get("Strict-Transport-Security")).toBe(HSTS);
    expect(HSTS).toContain("max-age=31536000");

    const dev = new Headers();
    applySecurityHeaders(dev, { production: false });
    expect(dev.get("Strict-Transport-Security")).toBeNull();
  });
});

describe("CSP nonce", () => {
  it("is fresh, unguessable base64 for every request (128 bits)", () => {
    const nonces = new Set(Array.from({ length: 50 }, () => createCspNonce()));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) {
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    }
  });

  it("is null outside a request (no middleware ran)", () => {
    expect(cspNonceOf(new RouterContextProvider())).toBeNull();
    expect(cspNonceOf(undefined)).toBeNull();
  });

  it("puts the nonce into the policy when one is given", () => {
    const headers = new Headers();
    applySecurityHeaders(headers, { production: false, nonce: "n0nce" });
    expect(headers.get("Content-Security-Policy")).toBe(contentSecurityPolicy("n0nce"));
  });
});

describe("withSecurityHeaders", () => {
  it("keeps status, body and the route's own headers", async () => {
    const original = new Response("{}", {
      status: 201,
      headers: { "Content-Type": "application/json", "Content-Disposition": "attachment" },
    });
    const response = withSecurityHeaders(original, { production: false });
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toBe("attachment");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await response.text()).toBe("{}");
  });

  it("also covers a response whose headers are immutable (Response.redirect)", () => {
    const response = withSecurityHeaders(Response.redirect("https://example.test/login", 302), {
      production: false,
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://example.test/login");
    expect(response.headers.get("Content-Security-Policy")).toBe(CSP);
  });
});

describe("securityHeadersMiddleware", () => {
  const argsWith = (context: RouterContextProvider) =>
    ({
      request: new Request("http://localhost/api/stream", { method: "POST" }),
      params: {},
      context,
    }) as unknown as Parameters<typeof securityHeadersMiddleware>[0];

  it("puts the headers on a resource route's response (API, exports)", async () => {
    const context = new RouterContextProvider();
    const response = (await securityHeadersMiddleware(
      argsWith(context),
      async () =>
        new Response("data: hi\n\n", { headers: { "Content-Type": "text/event-stream" } }),
    )) as Response;
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (key === "Content-Security-Policy") continue;
      expect(response.headers.get(key)).toBe(value);
    }
    expect(response.headers.get("Content-Security-Policy")).toBe(
      contentSecurityPolicy(cspNonceOf(context)),
    );
  });

  it("gives the render the same nonce the CSP header names, fresh per request", async () => {
    const seen: (string | null)[] = [];
    const policies: (string | null)[] = [];
    for (let i = 0; i < 2; i++) {
      const context = new RouterContextProvider();
      const response = (await securityHeadersMiddleware(argsWith(context), async () => {
        // entry.server renders inside next(): the nonce is already there.
        seen.push(cspNonceOf(context));
        return new Response("<html></html>");
      })) as Response;
      policies.push(response.headers.get("Content-Security-Policy"));
    }
    expect(seen[0]).toBeTruthy();
    expect(seen[0]).not.toBe(seen[1]);
    expect(policies).toEqual(seen.map((nonce) => contentSecurityPolicy(nonce)));
  });

  it("is the root route's middleware, so every matched route runs it", async () => {
    process.env.DATABASE_URL ??= "file::memory:";
    const root = await import("~/root");
    expect(root.middleware).toContain(securityHeadersMiddleware);
  });
});
