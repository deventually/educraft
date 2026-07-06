import { describe, it, expect } from "vitest";
import {
  NLQF_LEVELS,
  NLQF_SOURCE,
  NLQF_SOURCE_URL,
  nlqfToEqf,
  type NlqfLevel,
} from "~/lib/context/nlqf";

describe("nlqfToEqf — NLQF → EQF coupling (verified against nlqf.nl)", () => {
  it("couples NLQF 1–8 one-to-one with EQF, never an entry level", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const r = nlqfToEqf(String(n) as NlqfLevel);
      expect(r.eqf, `NLQF ${n}`).toBe(n);
      expect(r.entryLevel).toBe(false);
    }
  });

  it("derives EQF 4 for the NLQF 4+ rung (formal education, still EQF 4)", () => {
    expect(nlqfToEqf("4+")).toEqual({ eqf: 4, entryLevel: false });
  });

  it("approximates Instroomniveau to EQF 1 and flags it as an entry level", () => {
    // The Instroomniveau is genuinely below EQF 1 and cannot be coupled to EQF;
    // mapping it to EQF 1 is a documented engine approximation paired with a note.
    expect(nlqfToEqf("instroom")).toEqual({ eqf: 1, entryLevel: true });
  });
});

describe("NLQF_LEVELS catalogue", () => {
  it("lists the full waaier: Instroom + 1–8 + 4+", () => {
    const levels = NLQF_LEVELS.map((l) => l.level);
    expect(levels).toEqual(["instroom", "1", "2", "3", "4", "4+", "5", "6", "7", "8"]);
  });

  it("is fully bilingual (every level has nl + en)", () => {
    for (const l of NLQF_LEVELS) {
      expect(typeof l.label, l.level).not.toBe("string");
      const label = l.label as Record<string, string>;
      expect(label.nl?.length, `${l.level} nl`).toBeGreaterThan(0);
      expect(label.en?.length, `${l.level} en`).toBeGreaterThan(0);
    }
  });

  it("cites nlqf.nl as the source (no ISCED)", () => {
    expect(NLQF_SOURCE_URL).toContain("nlqf.nl");
    const src = JSON.stringify(NLQF_SOURCE) + NLQF_SOURCE_URL;
    expect(src).not.toContain("ISCED");
  });
});
