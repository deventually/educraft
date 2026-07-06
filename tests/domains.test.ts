import { describe, it, expect } from "vitest";
import { getDomainsForSector } from "~/lib/context/domains";
import { loc } from "~/lib/i18n/localized";
import { HBO_DOMAINS } from "~/lib/context/types";

describe("getDomainsForSector", () => {
  it("returns the full hbo domain catalogue for NL/hbo", () => {
    const values = getDomainsForSector("NL", "hbo").map((d) => d.value);
    expect(values).toEqual([...HBO_DOMAINS]);
    expect(values).toContain("ICT");
  });

  it("returns indicative vo domains (vmbo profielen + core vakken), bilingual", () => {
    const vo = getDomainsForSector("NL", "vo");
    expect(vo.length).toBeGreaterThan(0);
    for (const opt of vo) {
      expect(opt.value.length, `${opt.value} value`).toBeGreaterThan(0);
      expect(loc(opt.label, "nl").length, `${opt.value} nl`).toBeGreaterThan(0);
      expect(loc(opt.label, "en").length, `${opt.value} en`).toBeGreaterThan(0);
    }
    // A verified vmbo profiel is present (SLO).
    const nlLabels = vo.map((d) => loc(d.label, "nl"));
    expect(nlLabels.some((l) => /zorg en welzijn/i.test(l))).toBe(true);
  });

  it("returns an empty catalogue for sectors not built yet (mbo/wo)", () => {
    expect(getDomainsForSector("NL", "mbo")).toEqual([]);
    expect(getDomainsForSector("NL", "wo")).toEqual([]);
  });

  it("returns empty for an unknown country/sector or missing args", () => {
    expect(getDomainsForSector("XX", "hbo")).toEqual([]);
    expect(getDomainsForSector("NL", "banana")).toEqual([]);
    expect(getDomainsForSector(undefined, undefined)).toEqual([]);
  });
});
