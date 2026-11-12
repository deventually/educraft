import { describe, expect, it } from "vitest";
import { trackPrefillValues } from "~/lib/forms/values";
import type { InputField } from "~/lib/registry/types";

const fields = [
  { name: "document", kind: "textarea", label: { nl: "D", en: "D" } },
  {
    name: "feedbackHistory",
    kind: "textarea",
    label: { nl: "E", en: "E" },
    prefillFromTrack: { source: "feedbackHistory" },
  },
] as InputField[];

describe("trackPrefillValues (P38.4)", () => {
  it("fills a field from the track the tool was opened from", () => {
    expect(
      trackPrefillValues(fields, {
        feedbackHistory: "### Concepten, ronde 1\nNoem bronnen.",
        criteria: "",
        weakPoints: "",
      }),
    ).toEqual({
      feedbackHistory: "### Concepten, ronde 1\nNoem bronnen.",
    });
  });

  it("fills nothing without a track or without feedback", () => {
    expect(trackPrefillValues(fields, null)).toEqual({});
    expect(
      trackPrefillValues(fields, { feedbackHistory: "", criteria: "", weakPoints: "" }),
    ).toEqual({});
  });
});
