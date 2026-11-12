import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { PROMPTS, getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P39.1 — SLB-scenario's in Lastig gesprek oefenen. Two new conversations a study career
 * coach (SLB'er) has: bringing a negative binding study advice (BSA) and talking about
 * dropping out. The tool helps the teacher hold the conversation, never takes the BSA
 * decision (brief P39, principle 2). The new options change the prompt text, so @v3.
 */
const tool = () => getToolBySlug("difficult-conversation")!;
const scenario = () => tool().inputs.find((f) => f.name === "scenario")!;
const values = (s: string) => ({
  scenario: s,
  situation: "Eerstejaars student, 30 van de 45 studiepunten, het negatieve advies is genomen.",
  studentReaction: "emotional",
  practiceGoal: "",
});
const runtime = (s: string, lang: "nl" | "en") =>
  buildSystemPrompt({
    promptId: "difficult-conversation@v3",
    values: values(s),
    outputLanguage: lang,
  });

describe("difficult-conversation@v3 — SLB conversations (P39.1)", () => {
  it("runs on @v3 and keeps @v1 and @v2 registered", () => {
    expect(tool().stages[0]?.systemPromptId).toBe("difficult-conversation@v3");
    const ids = Object.values(PROMPTS).map((p) => p.id);
    for (const id of ["difficult-conversation@v1", "difficult-conversation@v2"]) {
      expect(ids).toContain(id);
    }
    expect(getPrompt("difficult-conversation@v3").verbatim).toMatch(/LimeOnIt/);
  });

  it("adds a negative study advice and dropping out as stable English slugs", () => {
    expect(scenario().options?.map((o) => o.value)).toEqual([
      "study-progress",
      "negative-study-advice",
      "bad-news-grade",
      "suspected-fraud",
      "student-stuck",
      "dropout",
    ]);
    const label = (v: string, lang: "nl" | "en") =>
      loc(scenario().options?.find((o) => o.value === v)?.label, lang);
    expect(label("negative-study-advice", "nl")).toBe("Een negatief studieadvies (BSA) brengen");
    expect(label("negative-study-advice", "en")).toBe("Bringing a negative binding study advice");
    expect(label("dropout", "nl")).toBe("Stoppen met de studie bespreken");
    expect(label("dropout", "en")).toBe("Talking about dropping out");
  });

  it("names the new conversations in the tagline and keywords", () => {
    expect(loc(tool().tagline, "nl")).toMatch(/negatief studieadvies/);
    expect(loc(tool().tagline, "nl")).toMatch(/stoppen/);
    expect(loc(tool().tagline, "en")).toMatch(/negative study advice/);
    expect(loc(tool().tagline, "en")).toMatch(/dropping out/);
    expect(TOOL_KEYWORDS["difficult-conversation"]).toEqual(
      expect.arrayContaining(["slb", "uitval", "stoppen", "dropout"]),
    );
  });

  it("says on the help page that it never takes the BSA decision", () => {
    expect(getToolHelpOverlay("difficult-conversation", "nl")).toMatch(/negatief studieadvies/);
    expect(getToolHelpOverlay("difficult-conversation", "nl")).toMatch(/besluit/);
    expect(getToolHelpOverlay("difficult-conversation", "en")).toMatch(/negative study advice/);
    expect(getToolHelpOverlay("difficult-conversation", "en")).toMatch(/decision/);
  });

  for (const s of ["negative-study-advice", "dropout"]) {
    for (const lang of ["nl", "en"] as const) {
      it(`resolves every placeholder for ${s} (${lang})`, () => {
        const p = runtime(s, lang);
        expect(p).not.toMatch(/\{\{\w+\}\}/);
        expect(p).toContain(`\`${s}\``);
      });
    }
  }

  it("explains each slug and its feedback, and never decides the BSA (nl)", () => {
    const p = runtime("negative-study-advice", "nl").toLowerCase();
    expect(p).toContain("`negative-study-advice`: een negatief bindend studieadvies brengen");
    expect(p).toContain("`dropout`: een gesprek over stoppen met de studie");
    // SPIKES for the negative advice (bad news), general technique for dropping out.
    expect(p).toContain("`negative-study-advice`, `bad-news-grade`");
    expect(p).toContain("bij stoppen met de studie");
    // Principle 2: no advice on a BSA decision, in the role or in the feedback.
    expect(p).toContain("geen advies over het bsa-besluit");
    expect(p).toContain("dat besluit neemt de opleiding");
    // The v2 guards stay.
    expect(p).toContain("in de ik-vorm");
    expect(p).toContain("verzin geen citaten");
    expect(p).toContain("dit is feedback op een oefengesprek met een gespeelde student.");
  });

  it("explains each slug and its feedback, and never decides the BSA (en)", () => {
    const p = runtime("dropout", "en").toLowerCase();
    expect(p).toContain("`negative-study-advice`: bringing a negative binding study advice");
    expect(p).toContain("`dropout`: a conversation about dropping out");
    expect(p).toContain("`negative-study-advice`, `bad-news-grade`");
    expect(p).toContain("when dropping out");
    expect(p).toContain("no advice on the bsa decision");
    expect(p).toContain("the programme takes that decision");
    expect(p).toContain("in the first person");
    expect(p).toContain("invent no quotes");
  });
});
