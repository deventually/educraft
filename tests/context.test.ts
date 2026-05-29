import { describe, it, expect } from "vitest";
import { formatProfile } from "~/lib/context/format";
import type { ContextProfile } from "~/lib/context/types";

const generic: ContextProfile = {
  id: "g1",
  name: "Verpleegkunde jaar 3",
  programme: "Verpleegkunde",
  domain: "Zorg & welzijn",
  courseName: "Acute zorg",
  studyYear: 3,
  eqf: 6,
  competencies: "Klinisch redeneren",
  professionalContext: "Ziekenhuis",
  tools: "Verpleegtechnieken",
};

const ict: ContextProfile = {
  id: "i1",
  name: "SE jaar 2",
  programme: "HBO-ICT",
  domain: "ICT",
  hboiLevel: 2,
  architectureLayers: ["Software", "Infrastructuur"],
  activities: ["Realiseren"],
  tools: "Java",
};

describe("formatProfile", () => {
  it("returns an empty string for a null/undefined profile", () => {
    expect(formatProfile(null, "nl")).toBe("");
    expect(formatProfile(undefined, "en")).toBe("");
  });

  it("renders generic hbo fields in Dutch", () => {
    const out = formatProfile(generic, "nl");
    expect(out).toContain("hbo");
    expect(out).toContain("Verpleegkunde");
    expect(out).toContain("EQF 6");
    expect(out).toContain("Klinisch redeneren");
    // No ICT pack for a non-ICT domain.
    expect(out).not.toContain("hbo-i");
  });

  it("renders generic hbo fields in English", () => {
    const out = formatProfile(generic, "en");
    expect(out).toContain("higher professional education");
    expect(out).toContain("Programme: Verpleegkunde");
    expect(out).toContain("Professional field: Ziekenhuis");
  });

  it("adds the hbo-i (ICT) pack only for the ICT domain", () => {
    const nl = formatProfile(ict, "nl");
    expect(nl).toContain("hbo-i");
    expect(nl).toContain("Software");
    expect(nl).toContain("Realiseren");
  });

  it("translates hbo-i framework terms in English output", () => {
    const en = formatProfile(ict, "en");
    expect(en).toContain("Software");
    expect(en).toContain("Infrastructure"); // Infrastructuur → Infrastructure
    expect(en).toContain("Realisation"); // Realiseren → Realisation
    expect(en).not.toContain("Realiseren");
  });

  it("does not add the ICT pack when ICT data is present but domain is not ICT", () => {
    const out = formatProfile({ ...ict, domain: "Techniek" }, "nl");
    expect(out).not.toContain("hbo-i");
  });
});
