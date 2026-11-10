import { describe, it, expect } from "vitest";
import { resolveFramework } from "~/lib/context/frameworks";
import { loc } from "~/lib/i18n/localized";

describe("resolveFramework — country → sector → domain → verified pack", () => {
  it("resolves the hbo-i pack for NL/hbo/ICT, with a cited source", () => {
    const pack = resolveFramework("NL", "hbo", "ICT");
    expect(pack).toBeDefined();
    expect(loc(pack!.source, "nl")).toContain("hbo-i");
    expect(pack!.fields.length).toBeGreaterThan(0);
  });

  it("resolves another hbo pack (Recht) too", () => {
    expect(resolveFramework("NL", "hbo", "Recht")).toBeDefined();
  });

  it("returns undefined for sectors with no packs yet (vo/mbo)", () => {
    expect(resolveFramework("NL", "vo", "ICT")).toBeUndefined();
    expect(resolveFramework("NL", "mbo", "ICT")).toBeUndefined();
    expect(resolveFramework("NL", "mbo", "mbo-ict")).toBeUndefined();
    expect(resolveFramework("NL", "mbo", "mbo-zorg-welzijn")).toBeUndefined();
  });

  it("falls back to the wo sector pack (Dublin descriptors) for every wo domain", () => {
    for (const domain of ["wo-techniek", "wo-recht", "wo-gezondheidszorg"]) {
      const pack = resolveFramework("NL", "wo", domain);
      expect(pack, domain).toBeDefined();
      expect(loc(pack!.source, "nl"), domain).toContain("Dublin");
      expect(pack!.sourceUrl, domain).toMatch(/^https:\/\//);
    }
  });

  it("encodes the five Dublin descriptors, without a level field (the track is the cycle)", () => {
    const pack = resolveFramework("NL", "wo", "wo-natuur")!;
    expect(pack.fields.map((f) => f.type)).toEqual(["multiselect"]);
    expect(pack.fields[0]!.options!.map((o) => o.value)).toEqual([
      "Kennis en inzicht",
      "Toepassen van kennis en inzicht",
      "Oordeelsvorming",
      "Communicatie",
      "Leervaardigheden",
    ]);
    expect(pack.fields[0]!.options!.map((o) => loc(o.label, "en"))).toEqual([
      "Knowledge and understanding",
      "Applying knowledge and understanding",
      "Making judgements",
      "Communication",
      "Learning skills",
    ]);
  });

  it("does not apply the sector pack without a domain", () => {
    expect(resolveFramework("NL", "wo", undefined)).toBeUndefined();
    expect(resolveFramework("NL", "wo", "")).toBeUndefined();
  });

  it("returns undefined for an unknown domain, sector, country, or missing arg", () => {
    expect(resolveFramework("NL", "hbo", "NotADomain")).toBeUndefined();
    expect(resolveFramework("NL", "banana", "ICT")).toBeUndefined();
    expect(resolveFramework("XX", "hbo", "ICT")).toBeUndefined();
    expect(resolveFramework(undefined, undefined, undefined)).toBeUndefined();
  });
});
