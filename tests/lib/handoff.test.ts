import { describe, expect, it } from "vitest";
import { takeHandoff, writeHandoff } from "~/lib/forms/handoff";

/** A utility hands values to a tool's form through this tab's sessionStorage (P24.5). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("handoff between a utility and a tool", () => {
  it("hands values to one tool, once", () => {
    const s = memoryStorage();
    expect(writeHandoff("test-analysis", { analysis: "| V1 | 0,75 |" }, s)).toBe(true);
    expect(takeHandoff("other-tool", s)).toBeNull();
    expect(takeHandoff("test-analysis", s)).toEqual({ analysis: "| V1 | 0,75 |" });
    expect(takeHandoff("test-analysis", s)).toBeNull();
  });

  it("ignores something that is not a map of strings", () => {
    const s = memoryStorage();
    s.setItem("limeonit:handoff:test-analysis", JSON.stringify({ analysis: 3 }));
    expect(takeHandoff("test-analysis", s)).toBeNull();
    s.setItem("limeonit:handoff:test-analysis", "{not json");
    expect(takeHandoff("test-analysis", s)).toBeNull();
  });

  it("fails quietly without storage (private mode, server render)", () => {
    expect(writeHandoff("test-analysis", { a: "b" }, undefined)).toBe(false);
    expect(takeHandoff("test-analysis", undefined)).toBeNull();
    const broken = memoryStorage();
    broken.setItem = () => {
      throw new Error("QuotaExceeded");
    };
    expect(writeHandoff("test-analysis", { a: "b" }, broken)).toBe(false);
  });
});
