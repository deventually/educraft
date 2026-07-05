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

// The country-neutral level-adaptation directive (EQF 1–8). The *only* thing the
// engine injects about level is the EQF number + this directive, so it works for
// any EQF country, not just NL. Exact-string asserts pin the contract.
const NL_DIRECTIVE = (n: number) =>
  `- Stem de complexiteit, voorbeelden en verwachtingen af op dit niveau (EQF ${n}); pas het taalregister alleen aan bij tekst die de lerende zelf leest. Noem het niveau zelf niet.`;
const EN_DIRECTIVE = (n: number) =>
  `- Match complexity, examples and expectations to this level (EQF ${n}); adapt the language register only for text the learner reads directly. Do not mention the level itself.`;

describe("formatProfile — EQF 1–8 level adaptation", () => {
  it("accepts the full ladder: EQF 1 (entry) and EQF 8 (doctorate)", () => {
    const eqf1 = formatProfile({ ...generic, eqf: 1 }, "nl");
    expect(eqf1).toContain("EQF 1");
    expect(eqf1).toContain(NL_DIRECTIVE(1));
    const eqf8 = formatProfile({ ...generic, eqf: 8 }, "nl");
    expect(eqf8).toContain("EQF 8");
    expect(eqf8).toContain(NL_DIRECTIVE(8));
  });

  it("appends the adaptation directive when eqf is set (NL), keyed to the level", () => {
    const out = formatProfile({ ...generic, eqf: 2 }, "nl");
    expect(out).toContain(NL_DIRECTIVE(2));
    // The directive never leaks a country-specific term — only the EQF number.
    expect(out).not.toContain("mbo");
    expect(out).not.toContain("havo");
  });

  it("localizes the directive to the output language (EN)", () => {
    const out = formatProfile({ ...generic, eqf: 6 }, "en");
    expect(out).toContain(EN_DIRECTIVE(6));
    expect(out).not.toContain(NL_DIRECTIVE(6));
  });

  it("omits the directive entirely when eqf is not set", () => {
    const { eqf, ...noEqf } = generic;
    const nl = formatProfile(noEqf, "nl");
    expect(nl).not.toContain("Stem de complexiteit");
    expect(nl).not.toContain("EQF");
    const en = formatProfile(noEqf, "en");
    expect(en).not.toContain("Match complexity");
  });
});
