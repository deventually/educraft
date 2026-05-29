import { describe, it, expect } from "vitest";
import { LocalizedError, localizeError } from "~/lib/i18n/errors";

describe("LocalizedError", () => {
  it("defaults Error.message to the English variant (for server logs)", () => {
    const e = new LocalizedError({ nl: "Hallo", en: "Hello" });
    expect(e.message).toBe("Hello");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("localizeError", () => {
  it("shows a LocalizedError in the requested locale", () => {
    const e = new LocalizedError({ nl: "Sleutel ontbreekt", en: "Key missing" });
    expect(localizeError(e, "nl", "fallback")).toBe("Sleutel ontbreekt");
    expect(localizeError(e, "en", "fallback")).toBe("Key missing");
  });

  it("passes a plain Error's message through", () => {
    expect(localizeError(new Error("boom"), "nl", "fallback")).toBe("boom");
  });

  it("uses the fallback for non-Error / empty values", () => {
    expect(localizeError("weird", "nl", "fallback")).toBe("fallback");
    expect(localizeError(new Error(""), "en", "fallback")).toBe("fallback");
  });
});
