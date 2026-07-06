import { describe, it, expect } from "vitest";
import {
  showsProgramme,
  showsProfessionalContext,
  showsPhase,
  showsStudyYear,
  showsDomain,
  courseLabel,
  domainFieldLabel,
} from "~/lib/context/relevance";
import { loc } from "~/lib/i18n/localized";

describe("showsProgramme", () => {
  it("hides Programme for the whole vo sector (no opleiding concept there)", () => {
    expect(showsProgramme("vo")).toBe(false);
  });

  it("shows Programme for mbo/hbo/wo", () => {
    expect(showsProgramme("mbo")).toBe(true);
    expect(showsProgramme("hbo")).toBe(true);
    expect(showsProgramme("wo")).toBe(true);
  });

  it("shows Programme for a legacy/undefined sector (no regression)", () => {
    expect(showsProgramme(undefined)).toBe(true);
    expect(showsProgramme("")).toBe(true);
  });
});

describe("showsProfessionalContext", () => {
  it("hides Professional field only for havo/vwo", () => {
    expect(showsProfessionalContext("vo", "havo")).toBe(false);
    expect(showsProfessionalContext("vo", "vwo")).toBe(false);
  });

  it("keeps Professional field for vmbo (a vocational track within vo)", () => {
    expect(showsProfessionalContext("vo", "vmbo-bb")).toBe(true);
    expect(showsProfessionalContext("vo", "vmbo-kb")).toBe(true);
    expect(showsProfessionalContext("vo", "vmbo-gl")).toBe(true);
    expect(showsProfessionalContext("vo", "vmbo-tl")).toBe(true);
  });

  it("keeps Professional field for mbo/hbo/wo regardless of track", () => {
    expect(showsProfessionalContext("mbo", "mbo-4")).toBe(true);
    expect(showsProfessionalContext("hbo", "bachelor")).toBe(true);
    expect(showsProfessionalContext("wo", "master")).toBe(true);
  });

  it("shows Professional field for a vo profile with no track chosen yet (onderbouw)", () => {
    expect(showsProfessionalContext("vo", undefined)).toBe(true);
    expect(showsProfessionalContext("vo", "")).toBe(true);
  });
});

describe("courseLabel", () => {
  it("labels the field 'Vak' in Dutch for every sector (subject-level term)", () => {
    for (const s of ["vo", "mbo", "hbo", "wo", undefined]) {
      expect(loc(courseLabel(s), "nl")).toBe("Vak");
    }
  });

  it("labels the field 'Subject' in English for vo and 'Course' elsewhere", () => {
    expect(loc(courseLabel("vo"), "en")).toBe("Subject");
    expect(loc(courseLabel("mbo"), "en")).toBe("Course");
    expect(loc(courseLabel("hbo"), "en")).toBe("Course");
    expect(loc(courseLabel("wo"), "en")).toBe("Course");
  });
});

describe("showsPhase", () => {
  it("shows the onderbouw/bovenbouw fase only for vo", () => {
    expect(showsPhase("vo")).toBe(true);
  });

  it("hides fase for mbo/hbo/wo and a legacy/undefined sector", () => {
    expect(showsPhase("mbo")).toBe(false);
    expect(showsPhase("hbo")).toBe(false);
    expect(showsPhase("wo")).toBe(false);
    expect(showsPhase(undefined)).toBe(false);
    expect(showsPhase("")).toBe(false);
  });
});

describe("showsStudyYear", () => {
  it("shows the numeric study year for hbo and mbo", () => {
    expect(showsStudyYear("hbo")).toBe(true);
    expect(showsStudyYear("mbo")).toBe(true);
  });

  it("hides the study year for vo (which uses fase) and for wo", () => {
    expect(showsStudyYear("vo")).toBe(false);
    expect(showsStudyYear("wo")).toBe(false);
  });

  it("hides the study year for a legacy/undefined sector", () => {
    expect(showsStudyYear(undefined)).toBe(false);
    expect(showsStudyYear("")).toBe(false);
  });
});

describe("showsDomain", () => {
  it("shows the profiel for vo only in the bovenbouw (it is a tweede-fase concept)", () => {
    expect(showsDomain("vo", "bovenbouw")).toBe(true);
  });

  it("hides the profiel for vo in the onderbouw or before a fase is chosen", () => {
    expect(showsDomain("vo", "onderbouw")).toBe(false);
    expect(showsDomain("vo", undefined)).toBe(false);
    expect(showsDomain("vo", "")).toBe(false);
  });

  it("keeps the domain field for every non-vo sector regardless of phase", () => {
    expect(showsDomain("hbo", undefined)).toBe(true);
    expect(showsDomain("mbo", "onderbouw")).toBe(true);
    expect(showsDomain("wo", undefined)).toBe(true);
    expect(showsDomain(undefined, undefined)).toBe(true);
  });
});

describe("domainFieldLabel", () => {
  it("labels the domain field 'Profiel' for vo and 'Domein' for every other sector", () => {
    expect(loc(domainFieldLabel("vo"), "nl")).toBe("Profiel");
    expect(loc(domainFieldLabel("vo"), "en")).toBe("Profile");
    for (const s of ["mbo", "hbo", "wo", undefined]) {
      expect(loc(domainFieldLabel(s), "nl")).toBe("Domein");
      expect(loc(domainFieldLabel(s), "en")).toBe("Domain");
    }
  });
});
