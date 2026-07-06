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

  it("returns undefined for sectors with no packs yet (po/vo/mbo/wo)", () => {
    expect(resolveFramework("NL", "vo", "ICT")).toBeUndefined();
    expect(resolveFramework("NL", "mbo", "ICT")).toBeUndefined();
    expect(resolveFramework("NL", "wo", "ICT")).toBeUndefined();
  });

  it("returns undefined for an unknown domain, sector, country, or missing arg", () => {
    expect(resolveFramework("NL", "hbo", "NotADomain")).toBeUndefined();
    expect(resolveFramework("NL", "banana", "ICT")).toBeUndefined();
    expect(resolveFramework("XX", "hbo", "ICT")).toBeUndefined();
    expect(resolveFramework(undefined, undefined, undefined)).toBeUndefined();
  });
});
