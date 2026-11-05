import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS, TOOL_KEYWORDS } from "~/lib/registry/goals";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.8 — Lastig gesprek oefenen. A chat tool for teachers: the AI plays a fictional student
 * in a conversation the teacher chooses (study progress, bad news about an assessment, a
 * suspicion of fraud, a student who is stuck). When the teacher asks for feedback, the AI
 * steps out of the role and gives feedback that quotes what the teacher actually said. For
 * bad news it follows the six steps of SPIKES (Baile et al., 2000, The Oncologist 5(4),
 * 302–311); for the other conversations general conversation technique without a model name.
 */
const tool = () => getToolBySlug("difficult-conversation")!;
const values = {
  scenario: "bad-news-grade",
  situation:
    "Tweedejaars student, het onderzoeksverslag is met een 4,2 beoordeeld. De student verwacht een voldoende.",
  studentReaction: "emotional",
  practiceGoal: "Het slechte nieuws snel en duidelijk brengen.",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "difficult-conversation@v1", values, outputLanguage: lang });

describe("tool: difficult-conversation", () => {
  it("registers as a chat tool for teachers that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("difficult-conversation");
    expect(t.mode).toBe("chat");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("difficult-conversation@v1");
    expect(t.enabled).toBe(true);
    expect(t.assistiveGrading).not.toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Lastig gesprek oefenen");
    expect(loc(tool().name, "en")).toBe("Practise a difficult conversation");
  });

  it("offers the brief's four conversations as stable English slugs", () => {
    const field = tool().inputs.find((f) => f.name === "scenario");
    expect(field?.required).toBe(true);
    expect(field?.kind).toBe("select");
    expect(field?.options?.map((o) => o.value)).toEqual([
      "study-progress",
      "bad-news-grade",
      "suspected-fraud",
      "student-stuck",
    ]);
  });

  it("asks for a situation, never for a name", () => {
    const t = tool();
    const situation = t.inputs.find((f) => f.name === "situation");
    expect(situation?.required).toBe(true);
    expect(situation?.kind).toBe("textarea");
    expect(loc(situation?.help, "nl").toLowerCase()).toContain("geen naam");
    expect(loc(situation?.help, "en").toLowerCase()).toContain("no name");
    for (const f of t.inputs) expect(f.name.toLowerCase(), f.name).not.toMatch(/name|naam/);
    expect(t.inputs.find((f) => f.name === "practiceGoal")?.required).not.toBe(true);
  });

  it("lets the teacher choose how the student reacts, never hostile", () => {
    const field = tool().inputs.find((f) => f.name === "studentReaction");
    expect(field?.required).toBe(true);
    expect(field?.options?.map((o) => o.value)).toEqual(["calm", "emotional", "defensive"]);
    expect(field?.defaultValue).toBe("emotional");
  });

  it("tells the teacher how to get feedback, in the greeting", () => {
    const g = tool().chat?.greeting;
    expect(loc(g, "nl")).toContain("Geef feedback");
    expect(loc(g, "en")).toContain("Give feedback");
    expect(tool().chat?.allowStop).toBe(true);
  });

  it("is an original LimeOnIt tool that names its verified source", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(["Baile et al. (2000)"]);
    expect(getPrompt("difficult-conversation@v1").verbatim).toMatch(/LimeOnIt/);
  });

  it("is findable under coaching, by 'gesprek', 'slecht nieuws' and 'spikes'", () => {
    expect(TOOL_GOALS["difficult-conversation"]).toBe("coach");
    expect(TOOL_KEYWORDS["difficult-conversation"]).toEqual(
      expect.arrayContaining([
        "gesprek",
        "slecht nieuws",
        "bad news",
        "studieadvies",
        "fraude",
        "spikes",
      ]),
    );
  });

  it("has a help page in both languages that explains how to get feedback", () => {
    expect(getToolHelpOverlay("difficult-conversation", "nl")).toContain("Geef feedback");
    expect(getToolHelpOverlay("difficult-conversation", "en")).toContain("Give feedback");
    expect(getToolHelpOverlay("difficult-conversation", "nl")).toContain("Baile");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.situation);
      expect(p).toContain(values.practiceGoal);
    });
  }

  it("guards the brief's demands (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("multi-turn");
    expect(p).toContain("fictieve student");
    expect(p).toContain("geef feedback");
    // The role stays stable; realistic, not hostile without a reason.
    expect(p).toContain("blijf in de rol");
    expect(p).toContain("niet vijandig zonder reden");
    // No legal or medical advice, in the role or in the feedback.
    expect(p).toContain("geen juridisch of medisch advies");
    // Privacy: no real student data.
    expect(p).toContain("verzonnen voornaam");
    // The feedback quotes what the teacher really said.
    expect(p).toContain("letterlijk");
    expect(p).toContain("verzin geen citaten");
    // SPIKES for bad news, honestly sourced; general technique for the rest.
    expect(p).toContain("spikes");
    expect(p).toContain("baile");
    expect(p).toContain("algemene gesprekstechniek");
    // The fixed feedback structure and closing.
    for (const h of ["### wat goed ging", "### wat beter kan", "### het gesprek in stappen"]) {
      expect(p, h).toContain(h);
    }
    expect(p).toMatch(/### e[ée]n ding om te oefenen/);
    expect(p).toContain("dit is feedback op een oefengesprek met een gespeelde student.");
    // Meting dc1: bold labels and numbered lists in the feedback; "zijn mouw", "haar neus".
    expect(p).toContain("gewone opsommingstekens, zonder vet en zonder nummers");
    expect(p).toContain("ook in de non-verbale aanwijzingen");
  });

  it("guards the brief's demands (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("multi-turn");
    expect(p).toContain("fictional student");
    expect(p).toContain("give feedback");
    expect(p).toContain("stay in the role");
    expect(p).toContain("not hostile without a reason");
    expect(p).toContain("no legal or medical advice");
    expect(p).toContain("made-up first name");
    expect(p).toContain("verbatim");
    expect(p).toContain("invent no quotes");
    expect(p).toContain("spikes");
    expect(p).toContain("baile");
    expect(p).toContain("general conversation technique");
    for (const h of [
      "### what went well",
      "### what could be better",
      "### the conversation in steps",
      "### one thing to practise",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("this is feedback on a practice conversation with a role-played student.");
    expect(p).toContain("plain bullets, without bold and without numbers");
    expect(p).toContain("also in the non-verbal cues");
  });
});
