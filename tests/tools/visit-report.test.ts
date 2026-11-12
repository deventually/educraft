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
    expect(tool().stages[0]!.systemPromptId).toBe("visit-report@v2");
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

  it("also writes up the final interview, chosen from the track's tab", () => {
    const kind = tool().inputs.find((f) => f.name === "occasion");
    expect(kind?.prefillFromTrack).toEqual({ source: "milestone" });
    expect(kind?.options?.map((o) => o.value)).toEqual(["visits", "final-interview"]);
    expect(kind?.defaultValue).toBe("visits");
    const nl = build("nl");
    expect(nl).toMatch(/`final-interview`: het eindgesprek/);
    expect(nl).toMatch(/### Presentatie/);
    expect(build("en")).toMatch(/### Presentation/);
    expect(nl).toMatch(/Geen oordeel/);
    // Eval eg: the teacher's own "C2 ruim voldoende" was copied; a place and order were invented.
    expect(nl).toMatch(/laat dat dan weg zonder het te noemen/);
    expect(build("en")).toMatch(/leave it out without mentioning it/);
    expect(nl).toMatch(/Voeg geen plaats, aanwezigen of volgorde toe/);
    // Eval eg2: attendance was still invented when the notes said nothing about it.
    expect(nl).toContain('schrijf dan alleen: "Verslag van het eindgesprek."');
    expect(build("en")).toContain('write only: "Report of the final interview."');
    expect(build("en")).toMatch(/Add no place, people present or order/);
  });

  it("writes only what the notes say, and keeps codes", () => {
    const nl = build("nl");
    expect(nl).toContain("- plan loopt");
    expect(nl).toMatch(/verzin niets/i);
    expect(nl).toMatch(/\[STUDENT\]/);
    expect(build("en")).toMatch(/invent nothing/i);
    for (const lang of ["nl", "en"] as const) expect(build(lang)).not.toMatch(/\{\{/);
  });

  it("never fills in who or when, and links a criterion only when the note does (eval vr1)", () => {
    expect(build("nl")).toContain("Vul nooit zelf een persoon of datum in.");
    expect(build("en")).toContain("Never fill in a person or date yourself.");
    expect(build("nl")).toMatch(/twijfel je, zet er dan geen criterium bij/);
    expect(build("en")).toMatch(/when in doubt, add no criterion/);
  });

  it("never copies a name the anonymisation missed (eval vr2)", () => {
    expect(build("nl")).toMatch(/neem je nooit over, ook niet één keer/);
    expect(build("en")).toMatch(/is never copied, not even once/);
    // Eval vr3: "supervisor" became "workplace supervisor".
    expect(build("nl")).toMatch(/met de woorden of codes uit de steekwoorden/);
    expect(build("en")).toMatch(/in the words or codes of the notes/);
  });
});
