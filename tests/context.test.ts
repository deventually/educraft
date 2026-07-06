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
  country: "NL",
  sector: "hbo",
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
  country: "NL",
  sector: "hbo",
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

describe("formatProfile — vo profiel injection (P10.2)", () => {
  const havo = {
    id: "h1",
    name: "5 havo N&T",
    country: "NL",
    sector: "vo",
    track: "havo",
    domain: "nt",
    nationalLevel: "4",
  } as ContextProfile;

  it("injects the vo profiel with a 'Profiel' label (no pack → not lost)", () => {
    expect(formatProfile(havo, "nl")).toContain("Profiel: Natuur & Techniek");
    expect(formatProfile(havo, "en")).toContain("Profile: Nature & Technology");
  });

  it("keeps the domain implicit for hbo (pack + programme carry it — June 2026 slimming)", () => {
    // ict resolves the hbo-i pack; no bare 'Domein: ICT' line is added.
    expect(formatProfile(ict, "nl")).not.toMatch(/Domein: ICT/);
    expect(formatProfile(generic, "nl")).not.toMatch(/Domein:/);
  });
});

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

// The learner-facing register-first directive (Phase 6.8). For the ~4 learner
// tutors the model addresses the student directly, so the register (vocabulary,
// sentence length, abstraction) leads — recalibrate to the learner, never name
// the level. Instructor tools keep the substance-first directive above.
const NL_DIRECT = (n: number) =>
  `- Stem je woordkeuze, zinslengte en abstractieniveau af op deze lerende (EQF ${n}); begin op dit niveau en herijk op wat de lerende laat zien. Noem het niveau zelf niet.`;
const EN_DIRECT = (n: number) =>
  `- Pitch your vocabulary, sentence length and level of abstraction to this learner (EQF ${n}); start there and recalibrate to what the learner shows. Do not mention the level itself.`;

describe("formatProfile — direct-address (learner) level adaptation", () => {
  it("emits the direct directive for a learner audience, not the substance one", () => {
    const nl = formatProfile({ ...generic, eqf: 4 }, "nl", "learner");
    expect(nl).toContain(NL_DIRECT(4));
    expect(nl).not.toContain(NL_DIRECTIVE(4));
    const en = formatProfile({ ...generic, eqf: 4 }, "en", "learner");
    expect(en).toContain(EN_DIRECT(4));
    expect(en).not.toContain(EN_DIRECTIVE(4));
  });

  it("keeps the substance directive for the instructor audience (default)", () => {
    const nlDefault = formatProfile({ ...generic, eqf: 4 }, "nl");
    const nlInstructor = formatProfile({ ...generic, eqf: 4 }, "nl", "instructor");
    expect(nlDefault).toContain(NL_DIRECTIVE(4));
    expect(nlDefault).not.toContain(NL_DIRECT(4));
    expect(nlInstructor).toContain(NL_DIRECTIVE(4));
  });

  it("never names the level in the direct directive", () => {
    const nl = formatProfile({ ...generic, eqf: 2 }, "nl", "learner");
    expect(nl).not.toContain("mbo");
    expect(nl).not.toContain("havo");
  });
});

// Phase 8.1 — the stored level is the national (NLQF) level; the engine derives
// and injects only the EQF number + the existing neutral directive. NLQF is the
// source of truth and outranks a legacy eqf; no national term ("NLQF"/"Instroom")
// ever reaches {{contextProfile}}.
describe("formatProfile — NLQF national level → derived EQF", () => {
  it("injects the derived EQF number from the stored nationalLevel", () => {
    // nationalLevel outranks the legacy eqf on the same profile.
    const out = formatProfile({ ...generic, nationalLevel: "7" }, "nl");
    expect(out).toContain("EQF 7");
    expect(out).toContain(NL_DIRECTIVE(7));
    expect(out).not.toContain("EQF 6"); // the legacy eqf:6 is not injected
  });

  it("appends one neutral entry-level note for the Instroomniveau (EQF 1)", () => {
    const nl = formatProfile({ ...generic, nationalLevel: "instroom" }, "nl");
    expect(nl).toContain("EQF 1");
    expect(nl).toContain(NL_DIRECTIVE(1));
    expect(nl).toContain("instapniveau"); // the neutral entry-level note
    const en = formatProfile({ ...generic, nationalLevel: "instroom" }, "en");
    expect(en).toContain("entry level");
  });

  it("never leaks a national term into the injected block", () => {
    for (const level of ["instroom", "2", "4+"] as const) {
      const nl = formatProfile({ ...generic, nationalLevel: level }, "nl");
      expect(nl, level).not.toContain("NLQF");
      expect(nl, level).not.toContain("Instroom");
    }
  });

  it("maps the 4+ rung to EQF 4", () => {
    expect(formatProfile({ ...generic, nationalLevel: "4+" }, "nl")).toContain("EQF 4");
  });

  it("keeps the legacy eqf fallback working (no nationalLevel)", () => {
    const { nationalLevel, ...noNat } = { ...generic } as typeof generic & {
      nationalLevel?: string;
    };
    void nationalLevel;
    expect(formatProfile(noNat, "nl")).toContain("EQF 6"); // from eqf:6
  });
});

// Phase 8.2 — the sector drives a learner-noun + teacher-noun directive so the
// right vocabulary reaches every tool without editing the prompt files. A vo
// class is "leerlingen"; mbo can toggle studenten↔deelnemers. No national term
// ("NLQF"/"Instroom") ever leaks. `pedagogy` (onderwijsconcept) is injected
// verbatim like professionalContext.
describe("formatProfile — sector-driven learner/teacher noun directive", () => {
  const vo = { id: "v1", name: "3 havo", sector: "vo", nationalLevel: "4" } as ContextProfile;
  const mbo = {
    id: "m1",
    name: "mbo-4 ICT",
    sector: "mbo",
    nationalLevel: "4",
    learnerNounOverride: "deelnemers",
  } as ContextProfile;

  it("names vo learners 'leerlingen' and the teacher 'docent'", () => {
    const nl = formatProfile(vo, "nl");
    expect(nl).toContain("leerlingen");
    expect(nl).toContain("docent");
    expect(nl).not.toContain("NLQF");
    expect(nl).not.toContain("Instroom");
  });

  it("localises the noun directive (vo → pupils/teacher in English)", () => {
    const en = formatProfile(vo, "en");
    expect(en).toContain("pupils");
    expect(en).toContain("teacher");
  });

  it("applies the mbo learner-noun override (studenten → deelnemers)", () => {
    expect(formatProfile(mbo, "nl")).toContain("deelnemers");
  });

  it("injects the noun directive for BOTH audiences", () => {
    expect(formatProfile(vo, "nl", "instructor")).toContain("leerlingen");
    expect(formatProfile(vo, "nl", "learner")).toContain("leerlingen");
  });

  it("adapts the intro to the sector (vo, not hbo)", () => {
    const nl = formatProfile(vo, "nl");
    expect(nl).toContain("voortgezet onderwijs");
    expect(nl).not.toContain("hoger beroepsonderwijs");
  });

  it("injects the pedagogy (onderwijsconcept) verbatim when set", () => {
    const p = { ...vo, pedagogy: "Daltononderwijs" } as ContextProfile;
    expect(formatProfile(p, "nl")).toContain("Daltononderwijs");
    expect(formatProfile(p, "en")).toContain("Daltononderwijs");
  });

  it("omits the noun directive when no sector is set (legacy profile)", () => {
    // The pre-P8 `generic` profile carries no sector — behaviour is unchanged.
    const nl = formatProfile(generic, "nl");
    expect(nl).not.toContain("leerlingen");
  });
});

// Phase 8.3 — the framework block is resolved via country→sector→domain, so it
// renders ONLY when a verified pack exists (hbo today). A vo/mbo/wo profile with
// a chosen domain shows no invented framework — the honest custom-fields fallback.
describe("formatProfile — framework block is sector-scoped", () => {
  it("renders the hbo-i framework for an hbo/ICT profile (pack resolves)", () => {
    expect(formatProfile(ict, "nl")).toContain("hbo-i domeinbeschrijving");
  });

  it("renders NO framework block for a vo profile, even with a domain + values", () => {
    const vo = {
      id: "v9",
      name: "vmbo-4 Z&W",
      country: "NL",
      sector: "vo",
      domain: "zw",
      // Even if a stray packValues survives, no vo pack exists → nothing invented.
      packValues: { canmedsRollen: ["Zorgverlener"] },
    } as ContextProfile;
    const nl = formatProfile(vo, "nl");
    expect(nl).not.toContain("Relevant kader");
    expect(nl).not.toContain("CanMEDS");
  });
});
