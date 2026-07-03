import { describe, it, expect } from "vitest";
import {
  SECURITY_HEADERS,
  CSP_REPORT_ONLY,
  applySecurityHeaders,
} from "~/server/securityHeaders.server";

describe("security headers", () => {
  it("sets the standard hardening headers", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("ships the CSP as report-only (not enforcing) until verified in the browser", () => {
    expect(SECURITY_HEADERS["Content-Security-Policy-Report-Only"]).toBe(CSP_REPORT_ONLY);
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toBeUndefined();
  });

  it("allows the Google Fonts sources root.tsx depends on", () => {
    expect(CSP_REPORT_ONLY).toContain("https://fonts.googleapis.com");
    expect(CSP_REPORT_ONLY).toContain("https://fonts.gstatic.com");
    expect(CSP_REPORT_ONLY).toContain("default-src 'self'");
    // React Router injects inline hydration scripts.
    expect(CSP_REPORT_ONLY).toContain("script-src 'self' 'unsafe-inline'");
    // Images may be data:/blob: (uploaded page previews).
    expect(CSP_REPORT_ONLY).toContain("img-src 'self' data: blob:");
  });

  it("applies every header onto a Headers object", () => {
    const headers = new Headers();
    applySecurityHeaders(headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(headers.get(key)).toBe(value);
    }
  });
});
