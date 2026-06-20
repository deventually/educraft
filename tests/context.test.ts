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
  tools: "Java",
  packValues: {
    beheersingsniveau: 2,
    architectuurlagen: ["Software", "Infrastructuur"],
    activiteiten: ["Realiseren"],
  },
};

const recht: ContextProfile = {
  id: "r1",
  name: "HBO-Rechten jaar 2",
  domain: "Recht",
  packValues: {
    leeruitkomsten: ["Juridisch analyseren", "Digitaliseren"],
    rechtsgebied: ["Strafrecht"],
  },
};

describe("formatProfile", () => {
  it("returns an empty string for a null/undefined profile", () => {
    expect(formatProfile(null, "nl")).toBe("");
    expect(formatProfile(undefined, "en")).toBe("");
  });

  it("renders generic hbo fields in Dutch (no pack line without packValues)", () => {
    const out = formatProfile(generic, "nl");
    expect(out).toContain("hbo");
    expect(out).toContain("Verpleegkunde");
    expect(out).toContain("EQF 6");
    // No framework block: a Zorg & welzijn pack exists, but this profile set no values.
    expect(out).not.toContain("Relevant kader");
    expect(out).not.toContain("CanMEDS");
  });

  it("slims the injected block: omits per-task / redundant fields", () => {
    // competencies + notes are per-task and restated by each tool's own inputs;
    // the domain line is implied by programme + the framework header. Cutting
    // them removes the redundancy that dilutes a generator's task instruction.
    const out = formatProfile({ ...generic, notes: "ZZZ_NOTE_MARKER" }, "nl");
    expect(out).not.toContain("Klinisch redeneren"); // competencies cut
    expect(out).not.toContain("ZZZ_NOTE_MARKER"); // notes cut
    expect(out).not.toContain("Domein/sector"); // redundant domain line cut
    // High-signal anchors stay.
    expect(out).toContain("Verpleegkunde"); // programme
    expect(out).toContain("Acute zorg"); // courseName
    expect(out).toContain("Studiejaar: 3"); // studyYear
    expect(out).toContain("EQF 6"); // eqf
    expect(out).toContain("Ziekenhuis"); // professionalContext
  });

  it("renders generic hbo fields in English", () => {
    const out = formatProfile(generic, "en");
    expect(out).toContain("higher professional education");
    expect(out).toContain("Programme: Verpleegkunde");
    expect(out).toContain("Professional field: Ziekenhuis");
  });

  it("adds the hbo-i (ICT) pack with its source, resolving option labels", () => {
    const nl = formatProfile(ict, "nl");
    expect(nl).toContain("hbo-i domeinbeschrijving");
    expect(nl).toContain("Software");
    expect(nl).toContain("Realiseren");
    expect(nl).toContain("2"); // beheersingsniveau
  });

  it("translates pack option labels in English output", () => {
    const en = formatProfile(ict, "en");
    expect(en).toContain("Software");
    expect(en).toContain("Infrastructure"); // Infrastructuur → Infrastructure
    expect(en).toContain("Realisation"); // Realiseren → Realisation
    expect(en).not.toContain("Realiseren");
  });

  it("renders any domain's pack — e.g. HBO-Rechten leeruitkomsten + rechtsgebied", () => {
    const nl = formatProfile(recht, "nl");
    expect(nl).toContain("HBO-Rechten");
    expect(nl).toContain("Juridisch analyseren");
    expect(nl).toContain("Strafrecht");
    const en = formatProfile(recht, "en");
    expect(en).toContain("Legal analysis"); // Juridisch analyseren → Legal analysis
    expect(en).toContain("Criminal law"); // Strafrecht → Criminal law
  });

  it("renders user-defined custom fields and skips incomplete ones", () => {
    const out = formatProfile(
      {
        id: "c1",
        name: "Agro",
        domain: "Agro, voeding & leefomgeving",
        customFields: [
          { label: "Specialisatie", value: "Precisielandbouw" },
          { label: "", value: "leeg" },
          { label: "Geen waarde", value: "" },
        ],
      },
      "nl",
    );
    expect(out).toContain("Specialisatie: Precisielandbouw");
    expect(out).not.toContain("leeg");
    expect(out).not.toContain("Geen waarde");
  });

  it("does not render the ICT source when the domain is not ICT", () => {
    const out = formatProfile({ ...ict, domain: "Techniek" }, "nl");
    expect(out).not.toContain("hbo-i domeinbeschrijving");
  });

  it("frames the context neutrally, not as a lesson being designed", () => {
    // The block is injected into every tool (chat tutors, graders, …), not just
    // lesson-design tools, so the intro must not assume a lesson is being made.
    const nl = formatProfile(generic, "nl");
    expect(nl).not.toContain("Deze les wordt ontworpen");
    expect(nl).toContain("hbo"); // still signals the education level
    const en = formatProfile(generic, "en");
    expect(en).not.toContain("This lesson is designed");
    expect(en).toContain("higher professional education");
  });
});
