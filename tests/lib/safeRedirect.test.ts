import { describe, expect, it } from "vitest";
import { safeRedirect } from "~/lib/safeRedirect";

describe("safeRedirect", () => {
  it.each(["/", "/tools/lesson-plan", "/courses?tab=open&q=a%20b", "/help#start"])(
    "keeps the same-app path %s",
    (to) => {
      expect(safeRedirect(to)).toBe(to);
    },
  );

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash after slash", "/\\evil.com"],
    ["backslash further on", "/foo\\bar"],
    ["absolute http URL", "https://evil.com/"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative path without leading slash", "evil.com"],
    ["tab that the URL parser strips", "/\t/evil.com"],
    ["newline (header injection)", "/foo\r\nSet-Cookie: x=1"],
    ["NUL byte", "/foo\u0000"],
    ["DEL character", "/foo\u007f"],
    ["empty string", ""],
  ])("rejects %s", (_label, to) => {
    expect(safeRedirect(to)).toBe("/");
  });

  it("rejects non-string input such as a File or null", () => {
    expect(safeRedirect(null)).toBe("/");
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect(new File(["x"], "x.txt"))).toBe("/");
  });

  it("uses the given fallback when the target is refused", () => {
    expect(safeRedirect("//evil.com", "/home")).toBe("/home");
  });
});

describe("set-locale action", () => {
  async function post(redirectTo: string) {
    const { action } = await import("~/routes/set-locale");
    const body = new FormData();
    body.set("locale", "en");
    body.set("redirectTo", redirectTo);
    const request = new Request("http://localhost/set-locale", { method: "POST", body });
    const args = { request } as unknown as Parameters<typeof action>[0];
    const response = (await action(args)) as Response;
    return response.headers.get("Location");
  }

  it("redirects back to a same-app path", async () => {
    expect(await post("/courses?tab=open")).toBe("/courses?tab=open");
  });

  it("sends a backslash trick to the home page", async () => {
    expect(await post("/\\evil.com")).toBe("/");
  });
});
