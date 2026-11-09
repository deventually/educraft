import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  CSP,
  HSTS,
  applySecurityHeaders,
  securityHeadersMiddleware,
  withSecurityHeaders,
} from "~/server/securityHeaders.server";

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

  it("allows the Google Fonts sources root.tsx depends on", () => {
    expect(CSP).toContain("https://fonts.googleapis.com");
    expect(CSP).toContain("https://fonts.gstatic.com");
    expect(CSP).toContain("default-src 'self'");
    // React Router injects inline hydration scripts.
    expect(CSP).toContain("script-src 'self' 'unsafe-inline'");
    // Images may be data:/blob: (uploaded page previews).
    expect(CSP).toContain("img-src 'self' data: blob:");
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
  const args = {
    request: new Request("http://localhost/api/stream", { method: "POST" }),
    params: {},
    context: {},
  } as unknown as Parameters<typeof securityHeadersMiddleware>[0];

  it("puts the headers on a resource route's response (API, exports)", async () => {
    const response = (await securityHeadersMiddleware(
      args,
      async () =>
        new Response("data: hi\n\n", { headers: { "Content-Type": "text/event-stream" } }),
    )) as Response;
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(key)).toBe(value);
    }
  });

  it("is the root route's middleware, so every matched route runs it", async () => {
    process.env.DATABASE_URL ??= "file::memory:";
    const root = await import("~/root");
    expect(root.middleware).toContain(securityHeadersMiddleware);
  });
});
