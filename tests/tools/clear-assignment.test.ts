import { describe, expect, it } from "vitest";
import { loc } from "~/lib/i18n/localized";
import { getPrompt } from "~/lib/prompts";
import { getToolBySlug } from "~/lib/registry";
import { TOOL_GOALS } from "~/lib/registry/goals";
import { TOOL_KEYWORDS } from "~/lib/registry/keywords";
import { buildSystemPrompt } from "~/lib/template/buildSystemPrompt";

/**
 * P24.6 — Opdracht helder schrijven. A one-shot instructor tool: rewrites an assignment or
 * student guide at a chosen CEFR reading level (B1 by default), with steps, criteria and
 * submission info, a list of open points ("you name no deadline") and a list of changes.
 * Content and requirements stay the same: no requirement disappears or is added.
 * Sources: CEFR Companion Volume (Council of Europe, 2020); CAST (2024), UDL Guidelines 3.0.
 */
const tool = () => getToolBySlug("clear-assignment")!;
const values = {
  assignment:
    "Schrijf een plan van aanpak (max. 2500 woorden) voor je stageopdracht. Lever in via Brightspace.",
  readingLevel: "B1",
  audience: "",
  keepAsIs: "",
};
const runtime = (lang: "nl" | "en") =>
  buildSystemPrompt({ promptId: "clear-assignment@v2", values, outputLanguage: lang });

describe("tool: clear-assignment", () => {
  it("registers as a one-shot, single-stage instructor tool that uses the context profile", () => {
    const t = tool();
    expect(t).toBeDefined();
    expect(t.id).toBe("clear-assignment");
    expect(t.mode).toBe("one-shot");
    expect(t.userType).toBe("instructor");
    expect(t.usesContextProfile).toBe(true);
    expect(t.stages).toHaveLength(1);
    expect(t.stages[0]?.systemPromptId).toBe("clear-assignment@v2");
    expect(t.enabled).toBe(true);
  });

  it("names the task first, in both languages", () => {
    expect(loc(tool().name, "nl")).toBe("Opdracht helder schrijven");
    expect(loc(tool().name, "en")).toBe("Write a clear assignment");
  });

  it("needs the assignment text and a reading level, B1 by default", () => {
    const field = (n: string) => tool().inputs.find((f) => f.name === n);
    expect(field("assignment")?.required).toBe(true);
    expect(field("assignment")?.kind).toBe("document");
    expect(field("readingLevel")?.required).toBe(true);
    expect(field("readingLevel")?.defaultValue).toBe("B1");
    expect(field("readingLevel")?.options?.map((o) => o.value)).toEqual(["A2", "B1", "B2", "C1"]);
    expect(field("audience")?.required).not.toBe(true);
    expect(field("keepAsIs")?.required).not.toBe(true);
  });

  it("is an original LimeOnIt tool that names its verified sources", () => {
    const t = tool();
    expect(t.attribution.original).toBe(true);
    expect(t.theory.keyCitations).toEqual(["Council of Europe (2020)", "CAST (2024)"]);
  });

  it("is findable under planning, by 'opdracht', 'b1' and 'taalniveau'", () => {
    expect(TOOL_GOALS["clear-assignment"]).toBe("design");
    expect(TOOL_KEYWORDS["clear-assignment"]).toEqual(
      expect.arrayContaining(["opdracht", "assignment", "b1", "taalniveau", "handleiding", "udl"]),
    );
  });

  it("has room for a long guide plus the requirement check", () => {
    expect(tool().defaultMaxTokens).toBeGreaterThanOrEqual(8192);
  });

  for (const lang of ["nl", "en"] as const) {
    it(`resolves every placeholder (${lang})`, () => {
      const p = runtime(lang);
      expect(p).not.toMatch(/\{\{\w+\}\}/);
      expect(p).toContain(values.assignment);
      expect(p).toContain("B1");
    });
  }

  it("guards the brief's demands (nl)", () => {
    const p = runtime("nl").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("verzin niets");
    expect(p).toContain("erk");
    expect(p).toContain("udl");
    // Brief 24.6: content and requirements stay the same; no requirement disappears or is added.
    expect(p).toContain("geen eis verdwijnt");
    expect(p).toContain("geen eis komt erbij");
    // The rewrite has steps, criteria and submission info; plus open points and changes.
    for (const part of ["stappen", "eisen", "inleveren", "open punten", "wat ik heb veranderd"]) {
      expect(p, part).toContain(part);
    }
    expect(p).toContain("je noemt geen deadline");
    // Known errors the tool must catch, never fix silently.
    expect(p).toContain("tegenstrijdig");
    expect(p).toContain("niet waarneembaar");
    expect(p).toContain("[in te vullen door de docent");
    expect(p).toContain("genderneutraal");
    expect(p).toContain(
      "dit is een concept. controleer of alle eisen kloppen voordat je de opdracht deelt.",
    );
  });

  it("guards the brief's demands (en)", () => {
    const p = runtime("en").toLowerCase();
    expect(p).toContain("voice & bounds");
    expect(p).toContain("invent nothing");
    expect(p).toContain("cefr");
    expect(p).toContain("udl");
    expect(p).toContain("no requirement disappears");
    expect(p).toContain("no requirement is added");
    for (const part of ["steps", "requirements", "submission", "open points", "what i changed"]) {
      expect(p, part).toContain(part);
    }
    expect(p).toContain("you name no deadline");
    expect(p).toContain("contradict");
    expect(p).toContain("not observable");
    expect(p).toContain("[to be filled in by the teacher");
    expect(p).toContain("gender-neutral");
    expect(p).toContain(
      "this is a draft. check that every requirement is right before you share the assignment.",
    );
  });

  it("fixes what meting ca1 showed: section order, an invented purpose, term explanations above the level", () => {
    const nl = runtime("nl").toLowerCase();
    const en = runtime("en").toLowerCase();
    // ca1: four of six outputs put the sections in a different order.
    expect(nl).toContain("begin je uitvoer met");
    expect(en).toContain("start your output with");
    // ca1 (policy brief): "Why this assignment?" gave a purpose the teacher did not name.
    expect(nl).toContain("alleen de markering");
    expect(en).toContain("only the marker");
    // ca1: explanations of terms ("kegelvormige glazen fles") above A2/B1.
    expect(nl).toContain("uitleg van een vakterm is zelf op het gekozen niveau");
    expect(en).toContain("explanation of a term is itself at the chosen level");
  });

  it("caps the open points at eight, most important first (ca2 once gave 14)", () => {
    const nl = runtime("nl").toLowerCase();
    const en = runtime("en").toLowerCase();
    expect(nl).toContain("hooguit 8 punten, het belangrijkste eerst");
    expect(en).toContain("at most 8 points, the most important first");
    // Nothing is lost: the rest goes in one line under the list.
    expect(nl).toContain('"ook:"');
    expect(en).toContain('"also:"');
  });

  it("keeps @v1 registered for sessions that still use it", () => {
    expect(getPrompt("clear-assignment@v1").id).toBe("clear-assignment@v1");
    expect(getPrompt("clear-assignment@v2").verbatim).toMatch(/LimeOnIt/);
  });

  it("asks for a requirement check table, in both languages", () => {
    expect(runtime("nl")).toContain("| Eis in het origineel | Waar in de herschreven opdracht |");
    expect(runtime("en")).toContain(
      "| Requirement in the original | Where in the rewritten assignment |",
    );
  });

  it("keeps an honest verbatim: the tool is not from the book", () => {
    expect(getPrompt("clear-assignment@v1").verbatim).toMatch(/LimeOnIt/);
  });
});
