import { describe, it, expect } from "vitest";
import { getLocale, localeSetCookie } from "~/lib/i18n/locale.server";

function req(cookie?: string): Request {
  return new Request("http://localhost/", cookie ? { headers: { Cookie: cookie } } : undefined);
}

describe("getLocale", () => {
  it("reads a valid lang cookie", () => {
    expect(getLocale(req("lang=en"))).toBe("en");
    expect(getLocale(req("lang=nl"))).toBe("nl");
  });

  it("reads the lang cookie among others", () => {
    expect(getLocale(req("theme=dark; lang=en; foo=bar"))).toBe("en");
  });

  it("defaults to nl when no cookie is present", () => {
    expect(getLocale(req())).toBe("nl");
  });

  it("ignores an invalid lang cookie", () => {
    expect(getLocale(req("lang=fr"))).toBe("nl");
    expect(getLocale(req("lang="))).toBe("nl");
  });
});

describe("localeSetCookie", () => {
  it("builds a persistent, path-scoped cookie", () => {
    const cookie = localeSetCookie("en");
    expect(cookie).toContain("lang=en");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=");
    expect(cookie).toContain("SameSite=Lax");
  });
});
