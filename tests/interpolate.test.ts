import { describe, it, expect } from "vitest";
import { interpolate, placeholdersIn } from "~/lib/template/interpolate";

describe("interpolate", () => {
  it("substitutes simple placeholders", () => {
    expect(interpolate("Hallo {{naam}}!", { naam: "Bas" })).toBe("Hallo Bas!");
  });

  it("joins arrays with newlines", () => {
    expect(interpolate("{{items}}", { items: ["a", "b", "c"] })).toBe("a\nb\nc");
  });

  it("throws on a missing, non-allowed placeholder", () => {
    expect(() => interpolate("{{a}} {{b}}", { a: "x" })).toThrow(/b/);
  });

  it("renders allowEmpty placeholders as empty when missing", () => {
    expect(interpolate("[{{ctx}}]", {}, { allowEmpty: ["ctx"] })).toBe("[]");
  });

  it("finds placeholder names", () => {
    expect(placeholdersIn("{{a}} {{b}} {{a}}").sort()).toEqual(["a", "b"]);
  });
});
