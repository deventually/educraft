import { describe, it, expect } from "vitest";
import { getDomainsForTrack, domainGroupsForSector, allDomainValues } from "~/lib/context/domains";
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

describe("domainGroupsForSector — admin per-teacher grouping (P10.3)", () => {
  it("returns one track-less group for hbo (sector-level catalogue)", () => {
    const groups = domainGroupsForSector("NL", "hbo");
    expect(groups.length).toBe(1);
    expect(groups[0].tracks).toEqual([]);
    expect(groups[0].domains.map((d) => d.value)).toEqual([...HBO_DOMAINS]);
  });

  it("merges vo tracks that share an identical profiel set (havo+vwo, vmbo bb/kb/gl)", () => {
    const groups = domainGroupsForSector("NL", "vo");
    // Three distinct groups: havo/vwo, vmbo bb/kb/gl, vmbo-tl.
    expect(groups.length).toBe(3);
    const havoVwo = groups.find((g) => g.tracks.includes("havo"));
    expect(havoVwo?.tracks.sort()).toEqual(["havo", "vwo"]);
    expect(havoVwo?.domains.map((d) => d.value).sort()).toEqual(["cm", "em", "ng", "nt"]);
    const vmbo = groups.find((g) => g.tracks.includes("vmbo-bb"));
    expect(vmbo?.tracks.sort()).toEqual(["vmbo-bb", "vmbo-gl", "vmbo-kb"]);
    expect(vmbo?.domains.length).toBe(10);
    const tl = groups.find((g) => g.tracks.includes("vmbo-tl"));
    expect(tl?.domains.length).toBe(4);
  });

  it("returns [] for a sector with no catalogue (mbo/wo)", () => {
    expect(domainGroupsForSector("NL", "mbo")).toEqual([]);
    expect(domainGroupsForSector("NL", "wo")).toEqual([]);
  });
});

describe("allDomainValues — the union of every valid domain slug (P10.3 filter)", () => {
  it("includes hbo domains and vo profielen, and nothing invented", () => {
    const all = allDomainValues("NL");
    expect(all).toContain("ICT"); // hbo
    expect(all).toContain("nt"); // havo/vwo
    expect(all).toContain("zw"); // vmbo beroepsgericht
    expect(all).toContain("zorg-welzijn"); // vmbo-tl
    expect(all).not.toContain("nederlands"); // dropped kernvak
    expect(all).not.toContain("not-a-domain");
  });

  it("returns [] for an unknown country", () => {
    expect(allDomainValues("XX")).toEqual([]);
    expect(allDomainValues(undefined)).toEqual([]);
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
