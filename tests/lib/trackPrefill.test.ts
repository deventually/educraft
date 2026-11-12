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

const track = { feedbackHistory: "", criteria: "", weakPoints: "" };
const moment = {
  name: "moment",
  kind: "select",
  label: { nl: "M", en: "M" },
  options: [
    { value: "midway", label: { nl: "H", en: "H" } },
    { value: "final-interview", label: { nl: "E", en: "E" } },
  ],
  prefillFromTrack: { source: "milestone" },
} as InputField;

describe("trackPrefillValues (P38.4)", () => {
  it("picks the option of the milestone the tool was opened from, and only an existing one", () => {
    expect(trackPrefillValues([moment], { ...track, milestone: "final-interview" })).toEqual({
      moment: "final-interview",
    });
    // From the visits tab there is no such option: the field keeps its default.
    expect(trackPrefillValues([moment], { ...track, milestone: "visits" })).toEqual({});
  });

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
