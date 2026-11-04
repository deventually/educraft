import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { PROMPTS, getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

const tool = () => getToolBySlug("mentorai")!;
const values = {
  discipline: "Wiskunde",
  studentContext: "Eerstejaars hbo, weinig zelfvertrouwen",
  learningGoal: "De kettingregel zelfstandig toepassen",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "mentorai@v2", values, outputLanguage: lang });

describe("mentorai@v2 — the book's Cognitive Apprenticeship Coach, generalised", () => {
  it("runs on mentorai@v2 and keeps @v1 registered", () => {
    expect(tool().stages[0]?.systemPromptId).toBe("mentorai@v2");
    const ids = Object.values(PROMPTS).map((p) => p.id);
    expect(ids).toContain("mentorai@v1");
    expect(ids).toContain("mentorai@v2");
  });

  it("keeps the real book prompt as verbatim (not a summary)", () => {
    const v = getPrompt("mentorai@v2").verbatim;
    expect(v).toContain("# Cognitive Apprenticeship Coach");
    expect(v).toContain("Read the learner, then make one move.");
    expect(v).toContain("Don't complete tasks for them (unless modeling)");
    expect(v).toContain("Situation-Behavior-Impact (SBI)");
    expect(v.split(/\s+/).length).toBeGreaterThan(2000);
  });

  it("credits the chapter authors and the prompt's pages", () => {
    const a = tool().attribution;
    expect(a.authors).toBe("Agarwal, Hadjiyiannis, Moagi & Koblic");
    expect(a.sourcePages).toBe("pp. 36–44");
    expect(a.adapted).toBe(true);
  });

  it("says in plain words what we changed from the book", () => {
    const a = tool().attribution;
    expect(loc(a.adaptation!, "nl")).toMatch(/SBI/);
    expect(loc(a.adaptation!, "nl")).toMatch(/vak/);
    expect(loc(a.adaptation!, "en")).toMatch(/SBI/);
    // No "improved" claim before a measurement shows it.
    expect(a.improvedAfter).toBeUndefined();
  });

  it("cites the theory behind it", () => {
    expect(tool().theory.keyCitations).toContain("Collins, Brown & Newman (1989)");
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      expect(runtime(lang)).not.toMatch(/\{\{\w+\}\}/);
      expect(runtime(lang)).toContain("De kettingregel zelfstandig toepassen");
    });
  }

  it("carries the book's conversation rules (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("één zet");
    expect(p).toContain("twee tot vijf zinnen");
    expect(p).toContain("eerste beurt");
    expect(p).toContain("volledige poging");
    expect(p).toContain("voorspel");
    expect(p).toContain("letterlijke woorden");
    expect(p).toContain("één vraag");
    expect(p).toContain("noem je zetten nooit");
  });

  it("carries the book's conversation rules (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("one move");
    expect(p).toContain("2–5 sentences");
    expect(p).toContain("first turn");
    expect(p).toContain("full attempt");
    expect(p).toContain("predict");
    expect(p).toContain("their own words");
    expect(p).toContain("one question");
    expect(p).toContain("never name your moves");
  });

  it("never solves the learner's own task, also not under pressure (nl + en)", () => {
    const nl = runtime("nl").toLowerCase();
    expect(nl).toContain("los de eigen opgave van de lerende nooit op");
    expect(nl).toContain("maak je beurt korter");
    const en = runtime("en").toLowerCase();
    expect(en).toContain("never solve the learner's own task");
    expect(en).toContain("compress your turn");
  });

  it("is clean Dutch: no leftovers from the old prompt", () => {
    const nl = runtime("nl");
    expect(nl).not.toMatch(/[Ѐ-ӿ]/); // Cyrillic
    for (const bad of ["guide de", "medical", "tegenzittingen", "minderaanspreking", "Versprin"]) {
      expect(nl).not.toContain(bad);
    }
  });

  it("greets without asking for a first step before there is a task", () => {
    const g = tool().chat!.greeting as { nl: string; en: string };
    expect(g.nl.toLowerCase()).not.toContain("eerste stap");
    expect(g.en.toLowerCase()).not.toContain("first step");
  });
});
