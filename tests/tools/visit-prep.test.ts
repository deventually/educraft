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
  it("resolves; of the student only the presentation goes in, after the name check", () => {
    expect(tool().stages[0]!.systemPromptId).toBe("visit-prep@v2");
    expect(tool().inputs.map((f) => f.name)).toEqual([
      "criteria",
      "moment",
      "interviewSetup",
      "presentation",
    ]);
    expect(
      tool()
        .inputs.filter((f) => f.redact)
        .map((f) => f.name),
    ).toEqual(["presentation"]);
    const p = tool().inputs.find((f) => f.name === "presentation");
    expect(p?.kind).toBe("document");
    expect(p?.required).toBe(false);
    expect(tool().handlesStudentWork).toBe(true);
  });

  it("fills the criteria from the track and requires them", () => {
    const f = tool().inputs.find((x) => x.name === "criteria");
    expect(f?.required).toBe(true);
    expect(f?.prefillFromTrack).toEqual({ source: "criteria" });
    // The presentation can go along now, so the help no longer says "nothing about the student".
    expect(loc(f!.help!, "nl")).toContain("de presentatie, zonder namen");
    expect(loc(f!.help!, "en")).toContain("the presentation, without names");
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

  it("stays under 600 words and skips what is not a criterion without saying so (eval vp1)", () => {
    expect(build("nl")).toMatch(/nooit meer dan 600/);
    expect(build("en")).toMatch(/never more than 600/);
    expect(build("nl")).toMatch(/sla die dan over zonder het te noemen/);
    expect(build("en")).toMatch(/skip it without mentioning it/);
  });

  it("prepares the final assessment after the presentation, chosen from the track's tab", () => {
    const moment = tool().inputs.find((f) => f.name === "moment");
    expect(moment?.prefillFromTrack).toEqual({ source: "milestone" });
    expect(moment?.options?.map((o) => o.value)).toEqual([
      "start",
      "midway",
      "final",
      "final-interview",
    ]);
    const nl = build("nl", { moment: "final-interview" });
    expect(nl).toMatch(/`final-interview`: het eindgesprek/);
    // What the final interview covers differs per programme: the teacher's setup leads.
    const setup = tool().inputs.find((f) => f.name === "interviewSetup");
    expect(setup?.required).toBe(false);
    // Kept once with the assessment model; a track fills it in.
    expect(setup?.prefillFromTrack).toEqual({ source: "interviewSetup" });
    const own = build("nl", {
      moment: "final-interview",
      interviewSetup: "Over de realisatie, de tweede helft van de stage.",
    });
    expect(own).toContain("Over de realisatie, de tweede helft van de stage.");
    expect(nl).toMatch(/verschilt per opleiding/);
    expect(build("en")).toMatch(/differs per programme/);
    const withDeck = build("nl", {
      moment: "final-interview",
      presentation: "Dia 1: [STUDENT] advies",
    });
    expect(withDeck).toContain("Dia 1: [STUDENT] advies");
    expect(nl).toMatch(/Over de presentatie/);
    expect(build("en", { moment: "final-interview" })).toMatch(/About the presentation/);
    // An assessment closes with what is needed for the final judgement, not with agreements.
    expect(nl).toMatch(/### Voor je oordeel/);
    // Eval eg2: a presentation heading at a midway visit, and questions that presuppose an answer.
    expect(nl).toMatch(/Bij elk ander moment schrijf je nooit een kopje over de presentatie/);
    expect(build("en")).toMatch(
      /At any other moment, never write a heading about the presentation/,
    );
    expect(nl).toMatch(/geen antwoord veronderstellen/);
    expect(build("en")).toMatch(/### For your judgement/);
  });

  it("is bilingual", () => {
    expect(loc(tool().name, "nl")).toMatch(/bezoek/i);
    expect(loc(tool().name, "en")).toMatch(/visit/i);
  });
});
