import { describe, it, expect } from "vitest";
import {
  SECTORS,
  SECTORS_INFO,
  TRACKS_BY_SECTOR,
  learnerNounFor,
  teacherNounFor,
} from "~/lib/context/sectors";

describe("sectors catalogue", () => {
  it("ships the full ladder minus primary education (po dropped)", () => {
    expect([...SECTORS]).toEqual(["vo", "mbo", "hbo", "wo"]);
  });

  it("has a bilingual label + learner/teacher noun for every sector", () => {
    for (const s of SECTORS) {
      const info = SECTORS_INFO[s];
      expect(info.label, s).toBeTruthy();
      expect(info.learnerNoun, s).toBeTruthy();
      expect(info.teacherNoun, s).toBeTruthy();
    }
  });
});

describe("learnerNounFor", () => {
  it("uses the sector default: vo → leerlingen, mbo/hbo/wo → studenten", () => {
    expect(learnerNounFor("vo", undefined, "nl")).toBe("leerlingen");
    expect(learnerNounFor("mbo", undefined, "nl")).toBe("studenten");
    expect(learnerNounFor("hbo", undefined, "nl")).toBe("studenten");
    expect(learnerNounFor("wo", undefined, "nl")).toBe("studenten");
  });

  it("localises the default to English (vo → pupils, else students)", () => {
    expect(learnerNounFor("vo", undefined, "en")).toBe("pupils");
    expect(learnerNounFor("hbo", undefined, "en")).toBe("students");
  });

  it("honours an mbo override (studenten ↔ deelnemers) in Dutch", () => {
    expect(learnerNounFor("mbo", "deelnemers", "nl")).toBe("deelnemers");
    // English makes no such distinction — falls back to the sector default.
    expect(learnerNounFor("mbo", "deelnemers", "en")).toBe("students");
  });
});

describe("teacherNounFor", () => {
  it("is docent across the shipped sectors (po/leerkracht is future work)", () => {
    for (const s of SECTORS) expect(teacherNounFor(s, "nl"), s).toBe("docent");
    expect(teacherNounFor("hbo", "en")).toBe("teacher");
  });
});

describe("TRACKS_BY_SECTOR", () => {
  it("covers every sector", () => {
    for (const s of SECTORS) expect(Array.isArray(TRACKS_BY_SECTOR[s]), s).toBe(true);
  });

  it("carries the verified NLQF anchors for the vo leerwegen (nlqf.nl)", () => {
    const vo = Object.fromEntries(
      TRACKS_BY_SECTOR.vo.map((t) => [t.value, t.defaultNationalLevel]),
    );
    expect(vo["vmbo-bb"]).toBe("1");
    expect(vo["vmbo-kb"]).toBe("2");
    expect(vo["vmbo-gl"]).toBe("2");
    expect(vo["vmbo-tl"]).toBe("2");
    expect(vo["havo"]).toBe("4");
    expect(vo["vwo"]).toBe("4+");
  });

  it("anchors the mbo levels 1–4", () => {
    const mbo = Object.fromEntries(
      TRACKS_BY_SECTOR.mbo.map((t) => [t.value, t.defaultNationalLevel]),
    );
    expect(mbo.entree).toBe("1");
    expect(mbo["mbo-4"]).toBe("4");
  });
});
