import { describe, expect, it } from "vitest";
import { profilePrefillValues } from "~/lib/forms/values";
import type { ContextProfile } from "~/lib/context/types";
import type { InputField } from "~/lib/registry/types";
import { getToolBySlug } from "~/lib/registry";

const PROFILE: ContextProfile = {
  id: "p1",
  name: "Verpleegkunde — jaar 2",
  programme: "Verpleegkunde",
  domain: "Zorg & welzijn",
  courseName: "Klinisch redeneren",
  pedagogy: "Probleemgestuurd onderwijs in kleine groepen",
};

const field = (prefill: InputField["prefillFromProfile"]): InputField => ({
  name: "f",
  label: { nl: "F", en: "F" },
  kind: "text",
  prefillFromProfile: prefill,
});

describe("profilePrefillValues: ordered sources", () => {
  it("takes the first source the profile has", () => {
    const f = field({ source: ["courseName", "programme"] });
    expect(profilePrefillValues([f], PROFILE)).toEqual({ f: "Klinisch redeneren" });
    expect(profilePrefillValues([f], { ...PROFILE, courseName: "" })).toEqual({
      f: "Verpleegkunde",
    });
  });

  it("prefills nothing when none of the sources is filled", () => {
    const f = field({ source: ["courseName", "programme"] });
    expect(profilePrefillValues([f], { id: "x", name: "X" })).toEqual({});
  });

  it("reads the pedagogy of the profile", () => {
    expect(profilePrefillValues([field({ source: "pedagogy" })], PROFILE)).toEqual({
      f: "Probleemgestuurd onderwijs in kleine groepen",
    });
  });
});

/**
 * Subject, discipline and topic fields start from the teaching context (BDB/BKE plan, PR 3):
 * what the profile already says is not asked again. The field stays editable.
 */
const EXPECTED: [toolId: string, fieldName: string, value: string][] = [
  ["arcs-reactor", "discipline", "Verpleegkunde"],
  ["authentic-assessment", "discipline", "Verpleegkunde"],
  ["mentorai", "discipline", "Verpleegkunde"],
  ["peer-tutoring", "discipline", "Verpleegkunde"],
  ["defend-your-work", "subject", "Klinisch redeneren"],
  ["defense-review", "subject", "Klinisch redeneren"],
  ["guided-reflection", "onderwerp", "Klinisch redeneren"],
  ["cognitive-architect", "gradeSubject", "Klinisch redeneren"],
  ["contextualization", "pedagogicalApproach", "Probleemgestuurd onderwijs in kleine groepen"],
];

describe("tools prefill subject, discipline and topic from the profile", () => {
  for (const [toolId, name, value] of EXPECTED) {
    it(`${toolId}.${name}`, () => {
      const tool = getToolBySlug(toolId);
      expect(tool?.usesContextProfile).toBe(true);
      expect(profilePrefillValues(tool!.inputs, PROFILE)[name]).toBe(value);
    });
  }

  it("a discipline falls back to the domain when the profile has no programme", () => {
    const tool = getToolBySlug("arcs-reactor")!;
    expect(profilePrefillValues(tool.inputs, { ...PROFILE, programme: undefined }).discipline).toBe(
      "Zorg & welzijn",
    );
  });
});
