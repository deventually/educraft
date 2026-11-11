import { describe, expect, it } from "vitest";
import { readEntry, writeEntry } from "~/lib/history/entryMemory";

/** A page's state per history entry, in this tab's sessionStorage (Back and Forward). */
function memoryStorage(limit = Number.POSITIVE_INFINITY): Storage {
  const map = new Map<string, string>();
  const size = () => [...map.values()].reduce((n, v) => n + v.length, 0);
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => {
      const before = map.get(k);
      map.set(k, v);
      if (size() > limit) {
        if (before === undefined) map.delete(k);
        else map.set(k, before);
        throw new DOMException("full", "QuotaExceededError");
      }
    },
  };
}

describe("entry memory", () => {
  it("gives back what was saved under an entry, and nothing for another", () => {
    const storage = memoryStorage();
    expect(writeEntry("a:tool", JSON.stringify({ output: "x" }), storage)).toBe(true);
    expect(readEntry("a:tool", storage)).toEqual({ output: "x" });
    expect(readEntry("b:tool", storage)).toBeNull();
  });

  it("keeps only the latest 30 entries", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 35; i++) writeEntry(`e${i}`, `"${i}"`, storage);
    expect(readEntry("e4", storage)).toBeNull();
    expect(readEntry("e5", storage)).toBe("5");
    expect(readEntry("e34", storage)).toBe("34");
  });

  it("makes room by dropping the other entries when the browser is full", () => {
    const storage = memoryStorage(400);
    writeEntry("old", JSON.stringify("o".repeat(200)), storage);
    expect(writeEntry("new", JSON.stringify("n".repeat(250)), storage)).toBe(true);
    expect(readEntry("old", storage)).toBeNull();
    expect(readEntry("new", storage)).toBe("n".repeat(250));
  });

  it("gives up quietly when even one entry does not fit, or storage is refused", () => {
    expect(writeEntry("big", JSON.stringify("b".repeat(500)), memoryStorage(100))).toBe(false);
    expect(writeEntry("x", "1", undefined)).toBe(false);
    expect(readEntry("x", undefined)).toBeNull();
  });

  it("reads broken saved text as nothing", () => {
    const storage = memoryStorage();
    storage.setItem("limeonit:entry:bad", "{not json");
    expect(readEntry("bad", storage)).toBeNull();
  });
});
