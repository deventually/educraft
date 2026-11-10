import { describe, expect, it } from "vitest";
import {
  PlacementSchema,
  PROGRAMME_LIMITS,
  ProgrammeInputSchema,
  programmeKindLabel,
} from "~/lib/programmes/schema";

const parses = (d: unknown) => ProgrammeInputSchema.safeParse(d).success;

describe("ProgrammeInputSchema (the boundary)", () => {
  it("accepts a programme with a sector, a track of that sector and a form", () => {
    expect(parses({ name: "HBO-ICT", sector: "hbo", track: "bachelor", form: "fulltime" })).toBe(
      true,
    );
    expect(parses({ name: "Master Informatica", sector: "wo", track: "master" })).toBe(true);
    expect(parses({ name: "Ad Software Development", sector: "hbo", track: "ad" })).toBe(true);
    expect(parses({ name: "Zonder niveau", sector: "mbo" })).toBe(true);
  });

  it("trims the name and refuses an empty or overlong one", () => {
    expect(ProgrammeInputSchema.parse({ name: "  HBO-ICT ", sector: "hbo" }).name).toBe("HBO-ICT");
    expect(parses({ name: "  ", sector: "hbo" })).toBe(false);
    expect(parses({ name: "x".repeat(PROGRAMME_LIMITS.name + 1), sector: "hbo" })).toBe(false);
  });

  it("refuses an unknown sector, a track of another sector and an unknown form", () => {
    expect(parses({ name: "x", sector: "po" })).toBe(false);
    expect(parses({ name: "x", sector: "hbo", track: "phd" })).toBe(false);
    expect(parses({ name: "x", sector: "hbo", form: "evening" })).toBe(false);
  });
});

describe("PlacementSchema (year and period of a course in a programme)", () => {
  it("accepts an empty placement and whole numbers in range", () => {
    expect(PlacementSchema.safeParse({}).success).toBe(true);
    expect(PlacementSchema.safeParse({ year: 1, period: 4 }).success).toBe(true);
  });

  it("refuses zero, fractions and numbers past the limits", () => {
    expect(PlacementSchema.safeParse({ year: 0 }).success).toBe(false);
    expect(PlacementSchema.safeParse({ period: 1.5 }).success).toBe(false);
    expect(PlacementSchema.safeParse({ year: PROGRAMME_LIMITS.year + 1 }).success).toBe(false);
    expect(PlacementSchema.safeParse({ period: PROGRAMME_LIMITS.period + 1 }).success).toBe(false);
  });
});

describe("programmeKindLabel", () => {
  it("reads as the track and form a teacher knows, in both languages", () => {
    const p = { sector: "hbo", track: "bachelor", form: "parttime" } as const;
    expect(programmeKindLabel(p, "nl")).toBe("hbo-bachelor · deeltijd");
    expect(programmeKindLabel(p, "en")).toBe("bachelor (hbo) · part-time");
  });

  it("falls back to the sector without a track or form", () => {
    expect(programmeKindLabel({ sector: "mbo", track: null, form: null }, "nl")).toBe("mbo");
  });
});
