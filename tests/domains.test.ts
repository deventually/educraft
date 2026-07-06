import { describe, it, expect } from "vitest";
import { getDomainsForTrack } from "~/lib/context/domains";
import { loc } from "~/lib/i18n/localized";
import { HBO_DOMAINS } from "~/lib/context/types";

describe("getDomainsForTrack — hbo (sector-level, track-independent)", () => {
  it("returns the full hbo domain catalogue regardless of track", () => {
    const values = getDomainsForTrack("NL", "hbo", "bachelor").map((d) => d.value);
    expect(values).toEqual([...HBO_DOMAINS]);
    expect(values).toContain("ICT");
    // Byte-identical whatever the (hbo) track — hbo has no track scoping.
    expect(getDomainsForTrack("NL", "hbo", "master").map((d) => d.value)).toEqual([...HBO_DOMAINS]);
  });
});

describe("getDomainsForTrack — vo profielen (track-scoped)", () => {
  it("offers the four havo/vwo profielen (N&T / N&G / E&M / C&M)", () => {
    for (const track of ["havo", "vwo"]) {
      const values = getDomainsForTrack("NL", "vo", track).map((d) => d.value);
      expect(values.sort(), track).toEqual(["cm", "em", "ng", "nt"]);
    }
  });

  it("offers the ten vmbo beroepsgerichte profielen for bb/kb/gl", () => {
    for (const track of ["vmbo-bb", "vmbo-kb", "vmbo-gl"]) {
      const values = getDomainsForTrack("NL", "vo", track).map((d) => d.value);
      expect(values.length, track).toBe(10);
      // A couple of verified SLO slugs are present.
      expect(values, track).toContain("bwi");
      expect(values, track).toContain("zw");
    }
  });

  it("offers the four vmbo-tl (mavo) sectoren", () => {
    const values = getDomainsForTrack("NL", "vo", "vmbo-tl").map((d) => d.value);
    expect(values.sort()).toEqual(["economie", "groen", "techniek", "zorg-welzijn"]);
  });

  it("drops the kernvakken from the domain catalogue (they belong in the Vak field)", () => {
    const all = ["havo", "vwo", "vmbo-bb", "vmbo-tl"].flatMap((tr) =>
      getDomainsForTrack("NL", "vo", tr).map((d) => d.value),
    );
    expect(all).not.toContain("nederlands");
    expect(all).not.toContain("engels");
    expect(all).not.toContain("wiskunde");
  });

  it("returns an empty list for a vo profile with no track chosen yet (onderbouw)", () => {
    expect(getDomainsForTrack("NL", "vo", undefined)).toEqual([]);
    expect(getDomainsForTrack("NL", "vo", "")).toEqual([]);
  });

  it("labels every vo profiel bilingually", () => {
    for (const track of ["havo", "vmbo-bb", "vmbo-tl"]) {
      for (const opt of getDomainsForTrack("NL", "vo", track)) {
        expect(loc(opt.label, "nl").length, `${opt.value} nl`).toBeGreaterThan(0);
        expect(loc(opt.label, "en").length, `${opt.value} en`).toBeGreaterThan(0);
      }
    }
    // A verified havo/vwo profiel reads naturally in Dutch.
    const havo = getDomainsForTrack("NL", "vo", "havo");
    expect(havo.find((d) => d.value === "nt")?.label).toMatchObject({ nl: "Natuur & Techniek" });
  });
});

describe("getDomainsForTrack — no catalogue / bad args", () => {
  it("returns [] for mbo and wo (no verified catalogue)", () => {
    expect(getDomainsForTrack("NL", "mbo", "mbo-4")).toEqual([]);
    expect(getDomainsForTrack("NL", "wo", "master")).toEqual([]);
  });

  it("returns [] for an unknown country/sector or missing args", () => {
    expect(getDomainsForTrack("XX", "hbo", "bachelor")).toEqual([]);
    expect(getDomainsForTrack("NL", "banana", "x")).toEqual([]);
    expect(getDomainsForTrack(undefined, undefined, undefined)).toEqual([]);
  });
});
