import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { profilePrefillValues } from "~/lib/forms/values";
import type { ContextProfile } from "~/lib/context/types";

const profile = (studyYear?: 1 | 2 | 3 | 4): ContextProfile => ({ id: "p", name: "p", studyYear });

describe("tool: authentic-assessment", () => {
  it("registers and resolves by slug", () => {
    expect(getToolBySlug("authentieke-toetsing")?.id).toBe("authentic-assessment-backward-design");
  });

  it("derives the level from the profile's study year (no double entry)", () => {
    const tool = getToolBySlug("authentieke-toetsing")!;
    expect(tool.inputs.find((f) => f.name === "niveau")?.prefillFromProfile?.source).toBe(
      "studyYear",
    );
    expect(profilePrefillValues(tool.inputs, profile(1)).niveau).toBe("introductory");
    expect(profilePrefillValues(tool.inputs, profile(2)).niveau).toBe("advanced");
    expect(profilePrefillValues(tool.inputs, profile(4)).niveau).toBe("graduation phase");
    // No study year → falls back to the field's own default, not a prefill.
    expect(profilePrefillValues(tool.inputs, profile(undefined)).niveau).toBeUndefined();
  });
});
