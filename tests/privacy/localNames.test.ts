import { describe, it, expect } from "vitest";
import {
  addStudent,
  clearBatch,
  loadBatch,
  newBatch,
  removeStudent,
  restoreNames,
  saveBatch,
  setLevel,
  updateStudent,
} from "~/lib/privacy/localNames";

/** A minimal Storage stand-in. */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const R = "rubric-1";

describe("local batch (names stay in the browser)", () => {
  it("gives each new student the next code, with an optional name", () => {
    let b = newBatch(R);
    b = addStudent(b, "Sam de Vries");
    b = addStudent(b, "");
    b = addStudent(b, "  Noor  ");
    expect(b.students.map((s) => [s.code, s.name])).toEqual([
      [1, "Sam de Vries"],
      [2, ""],
      [3, "Noor"],
    ]);
  });

  it("never reuses a code after a student is removed", () => {
    let b = addStudent(addStudent(newBatch(R), "A"), "B");
    b = removeStudent(b, 2);
    b = addStudent(b, "C");
    expect(b.students.map((s) => s.code)).toEqual([1, 3]);
  });

  it("is immutable", () => {
    const b = addStudent(newBatch(R), "A");
    const next = setLevel(b, 1, "crit", "level");
    expect(b.students[0].levels).toEqual({});
    expect(next.students[0].levels).toEqual({ crit: "level" });
    const renamed = updateStudent(next, 1, { name: "Ab", comment: "netjes" });
    expect(next.students[0].name).toBe("A");
    expect(renamed.students[0]).toMatchObject({ name: "Ab", comment: "netjes" });
  });

  it("links and restores: saves per rubric and loads it back", () => {
    const storage = memoryStorage();
    const b = setLevel(addStudent(newBatch(R), "Sam"), 1, "c", "l");
    saveBatch(b, storage);
    expect(loadBatch(R, storage)).toEqual(b);
    expect(loadBatch("other-rubric", storage)).toBeNull();
  });

  it("puts the name back next to the code, or only the code without a name", () => {
    let b = addStudent(addStudent(newBatch(R), "Sam"), "");
    b = addStudent(b, "Noor");
    expect(restoreNames(b, (n) => `Student ${n}`)).toEqual([
      "Student 1 — Sam",
      "Student 2",
      "Student 3 — Noor",
    ]);
  });

  it("clears the names and comments of a batch", () => {
    const storage = memoryStorage();
    saveBatch(updateStudent(addStudent(newBatch(R), "Sam"), 1, { comment: "x" }), storage);
    saveBatch(addStudent(newBatch("keep"), "Kim"), storage);
    clearBatch(R, storage);
    expect(loadBatch(R, storage)).toBeNull();
    expect(loadBatch("keep", storage)?.students[0].name).toBe("Kim");
    expect(JSON.stringify([...Array(storage.length)].map((_, i) => storage.key(i)))).not.toMatch(R);
  });

  it("survives a broken or missing storage", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(loadBatch(R, throwing)).toBeNull();
    expect(() => saveBatch(newBatch(R), throwing)).not.toThrow();
    expect(() => clearBatch(R, throwing)).not.toThrow();
    expect(loadBatch(R, undefined)).toBeNull();
  });

  it("ignores stored junk", () => {
    const storage = memoryStorage();
    saveBatch(newBatch(R), storage);
    const key = storage.key(0)!;
    storage.setItem(key, "{not json");
    expect(loadBatch(R, storage)).toBeNull();
    storage.setItem(key, JSON.stringify({ rubricId: R, students: "nope" }));
    expect(loadBatch(R, storage)).toBeNull();
  });
});
