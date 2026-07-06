import { describe, it, expect } from "vitest";
import { showsProgramme, showsProfessionalContext, courseLabel } from "~/lib/context/relevance";
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
