import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P39.2 — Een gesprek voorbereiden. A one-shot tool for a study career coach (SLB'er): a set of
 * questions for one conversation situation. Only the situation, never the student (brief P39,
 * principle 1); no advice on a BSA decision (2); no counter is named that is not in the
 * institution's own list, which does not exist yet (3, P39.4).
 */
const tool = () => getToolBySlug("conversation-prep")!;
const values = {
  situation: "negative-study-advice",
  phase: "propaedeutic",
  goal: "Samen kijken wat er nodig is om de laatste herkansingen te halen.",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "conversation-prep@v1", values, outputLanguage: lang });

describe("tool: conversation-prep", () => {
  it("registers as a one-shot tool for teachers that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages.map((s) => s.systemPromptId)).toEqual(["conversation-prep@v1"]);
    expect(t.enabled).toBe(true);
    expect(t.handlesStudentWork).not.toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Een gesprek voorbereiden");
    expect(loc(tool().name, "en")).toBe("Prepare a conversation");
  });

  it("offers the brief's five situations and two phases as stable English slugs", () => {
    const situation = tool().inputs.find((f) => f.name === "situation");
    expect(situation?.kind).toBe("select");
    expect(situation?.required).toBe(true);
    expect(situation?.options?.map((o) => o.value)).toEqual([
      "start",
      "progress",
      "negative-study-advice",
      "dropout",
      "minor-or-internship-choice",
    ]);
    const phase = tool().inputs.find((f) => f.name === "phase");
    expect(phase?.required).toBe(true);
    expect(phase?.options?.map((o) => o.value)).toEqual(["propaedeutic", "main-phase"]);
  });

  it("asks for the situation, never for the student", () => {
    const t = tool();
    expect(t.inputs.map((f) => f.name)).toEqual(["situation", "phase", "goal"]);
    const goal = t.inputs.find((f) => f.name === "goal");
    expect(goal?.required).not.toBe(true);
    expect(loc(goal?.help, "nl").toLowerCase()).toContain("geen namen of persoonlijke gegevens");
    expect(loc(goal?.help, "en").toLowerCase()).toContain("no names or personal details");
  });

  it("leads to practising the conversation, and back", () => {
    expect(tool().next).toEqual(["difficult-conversation"]);
    expect(getToolBySlug("difficult-conversation")?.next).toEqual(["conversation-prep"]);
  });

  it("is an original LimeOnIt tool, findable under coaching", () => {
    expect(tool().attribution.original).toBe(true);
    expect(getPrompt("conversation-prep@v1").verbatim).toMatch(/LimeOnIt/);
    expect(TOOL_GOALS["conversation-prep"]).toBe("coach");
    expect(TOOL_KEYWORDS["conversation-prep"]).toEqual(
      expect.arrayContaining(["slb", "gesprek voorbereiden", "bsa", "vragen"]),
    );
  });

  it("has a help page in both languages that says it never asks about the student", () => {
    expect(getToolHelpOverlay("conversation-prep", "nl")).toMatch(/geen namen/i);
    expect(getToolHelpOverlay("conversation-prep", "en")).toMatch(/no names/i);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.goal);
      expect(p).toContain("`negative-study-advice`");
    });
  }

  it("guards the brief's demands (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    for (const h of [
      "### openingsvragen",
      "### doorvragen",
      "### wat je niet vraagt",
      "### afsluiten en afspraken",
      "### verwijs door",
    ]) {
      expect(p, h).toContain(h);
    }
    // Principle 1: the situation, never the student.
    expect(p).toContain("nooit over een bepaalde student");
    expect(p).toContain("gezondheid, de thuissituatie of geld");
    // Principle 2: no advice on the BSA decision.
    expect(p).toContain("geen advies over het bsa-besluit");
    // Principle 3: no counter by name until the institution has its own list (P39.4).
    expect(p).toContain("noem geen loket bij naam");
    expect(p).toContain("dit is een vragenset voor een situatie, niet voor een bepaalde student.");
  });

  it("guards the brief's demands (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    for (const h of [
      "### opening questions",
      "### follow-up questions",
      "### what you do not ask",
      "### closing and agreements",
      "### refer on",
    ]) {
      expect(p, h).toContain(h);
    }
    expect(p).toContain("never about a particular student");
    expect(p).toContain("health, the home situation or money");
    expect(p).toContain("no advice on the bsa decision");
    expect(p).toContain("name no counter by name");
    expect(p).toContain(
      "this is a set of questions for a situation, not for a particular student.",
    );
  });
});
