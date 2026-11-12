import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";
import { defaultValuesFor, toTemplateValues } from "~/lib/forms/values";

/** P38.6: a visit report from the teacher's notes; names out first, and nothing is kept. */
const tool = () => getToolBySlug("visit-report")!;
const build = (lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: tool().stages[0]!.systemPromptId,
    values: { ...toTemplateValues(defaultValuesFor(tool().inputs)), notes: "- plan loopt" },
    outputLanguage: lang,
  });

describe("tool: visit-report (P38.6)", () => {
  it("resolves, keeps nothing", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("visit-report@v1");
    expect(tool().storesConversation).toBe(false);
    expect(tool().handlesStudentWork).toBe(true);
  });

  it("runs the notes through the name check and takes the criteria from the track", () => {
    const notes = tool().inputs.find((f) => f.name === "notes");
    expect(notes?.redact).toBe(true);
    expect(notes?.required).toBe(true);
    expect(tool().inputs.find((f) => f.name === "criteria")?.prefillFromTrack).toEqual({
      source: "criteria",
    });
  });

  it("writes only what the notes say, and keeps codes", () => {
    const nl = build("nl");
    expect(nl).toContain("- plan loopt");
    expect(nl).toMatch(/verzin niets/i);
    expect(nl).toMatch(/\[STUDENT\]/);
    expect(build("en")).toMatch(/invent nothing/i);
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });
});
