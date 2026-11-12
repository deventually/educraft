import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { defaultValuesFor, toTemplateValues } from "~/lib/forms/values";
import { loc } from "~/lib/i18n/localized";

/** P38.6: questions for a visit, from the criteria only: nothing about the student goes in. */
const tool = () => getToolBySlug("visit-prep")!;
const build = (lang: "nl" | "en", values: Record<string, string> = {}) =>
  buildSystemPrompt({
    promptId: tool().stages[0]!.systemPromptId,
    values: {
      ...toTemplateValues(defaultValuesFor(tool().inputs)),
      criteria: "C1 Analyse",
      ...values,
    },
    outputLanguage: lang,
  });

describe("tool: visit-prep (P38.6)", () => {
  it("resolves, takes nothing about the student", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("visit-prep@v1");
    expect(tool().inputs.map((f) => f.name)).toEqual(["criteria", "moment"]);
    expect(tool().inputs.some((f) => f.redact)).toBe(false);
  });

  it("fills the criteria from the track and requires them", () => {
    const f = tool().inputs.find((x) => x.name === "criteria");
    expect(f?.required).toBe(true);
    expect(f?.prefillFromTrack).toEqual({ source: "criteria" });
  });

  it("asks questions for the student and for the workplace supervisor, per criterion", () => {
    const nl = build("nl");
    expect(nl).toContain("C1 Analyse");
    expect(nl).toMatch(/praktijkbegeleider/);
    expect(nl).toMatch(/per criterium/i);
    const en = build("en");
    expect(en).toMatch(/workplace supervisor/);
    expect(en).toMatch(/per criterion/i);
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });

  it("is bilingual", () => {
    expect(loc(tool().name, "nl")).toMatch(/bezoek/i);
    expect(loc(tool().name, "en")).toMatch(/visit/i);
  });
});
