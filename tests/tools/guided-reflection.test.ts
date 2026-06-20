import { describe, it, expect } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { profilePrefillValues } from "~/lib/forms/values";
import type { ContextProfile } from "~/lib/context/types";

const profile = (studyYear?: 1 | 2 | 3 | 4): ContextProfile => ({ id: "p", name: "p", studyYear });

describe("tool: guided-reflection", () => {
  it("registers and resolves by slug", () => {
    expect(getToolBySlug("guided-reflection")?.id).toBe("guided-reflection-backward-design");
  });

  it("derives the level from the profile's study year (no double entry)", () => {
    const tool = getToolBySlug("guided-reflection")!;
    expect(tool.inputs.find((f) => f.name === "niveau")?.prefillFromProfile?.source).toBe(
      "studyYear",
    );
    expect(profilePrefillValues(tool.inputs, profile(1)).niveau).toBe("foundation year (year 1)");
    expect(profilePrefillValues(tool.inputs, profile(3)).niveau).toBe("main phase (years 2-3)");
    expect(profilePrefillValues(tool.inputs, profile(4)).niveau).toBe("graduation phase (year 4)");
    // No study year → keeps the field's own default, not a prefill.
    expect(profilePrefillValues(tool.inputs, profile(undefined)).niveau).toBeUndefined();
  });
});
