import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getToolBySlug } from "~/lib/registry";
import { COUNTED_CHECKS, parseHardChecks } from "../../scripts/eval-helpers";

const dir = join(__dirname, "../../evals/difficult-conversation");
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");
const cases = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")).cases as {
  id: string;
  description: string;
  outputLanguage: "nl" | "en";
  values: Record<string, string>;
  userTurns: string[];
}[];

const FEEDBACK = { nl: /geef feedback/i, en: /give feedback/i };

/** The quality gate of brief P24 for a new tool (24.8). */
describe("difficult-conversation eval meets the P24 quality gate", () => {
  it("has at least five cases: three ordinary, two with a known error, one in English", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    const known = cases.filter((c) => /known-error/.test(c.id));
    expect(known.length).toBeGreaterThanOrEqual(2);
    expect(cases.length - known.length).toBeGreaterThanOrEqual(3);
    expect(cases.some((c) => c.outputLanguage === "en")).toBe(true);
  });

  it("covers all four conversations of the brief", () => {
    const scenarios = new Set(cases.map((c) => c.values.scenario));
    expect([...scenarios].sort()).toEqual(
      ["bad-news-grade", "student-stuck", "study-progress", "suspected-fraud"].sort(),
    );
  });

  it("plays at least eight teacher turns in the role, then asks for feedback", () => {
    for (const c of cases) {
      const last = c.userTurns.at(-1) ?? "";
      expect(last, c.id).toMatch(FEEDBACK[c.outputLanguage]);
      const inRole = c.userTurns.slice(0, -1);
      expect(inRole.length, c.id).toBeGreaterThanOrEqual(8);
      for (const t of inRole) expect(t, c.id).not.toMatch(FEEDBACK[c.outputLanguage]);
    }
  });

  it("only uses the tool's own inputs", () => {
    const names = new Set(getToolBySlug("difficult-conversation")!.inputs.map((f) => f.name));
    for (const c of cases) {
      for (const key of Object.keys(c.values)) expect(names.has(key), `${c.id}: ${key}`).toBe(true);
    }
  });

  it("judges the brief's own expectations", () => {
    expect(rubric).toMatch(/SPIKES/);
    const ids = parseHardChecks(rubric).map((c) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "missedKnownError",
        "brokeCharacter",
        "longRoleTurn",
        "unrealisticStudent",
        "feedbackWithoutQuotes",
        "noFeedbackOnRequest",
        "legalOrMedicalAdvice",
        "inventedSources",
      ]),
    );
    expect(parseHardChecks(rubric).find((c) => c.id === "longRoleTurn")?.counted).toBe(true);
  });
});

describe("longRoleTurn (counted)", () => {
  const role = (s: string) => `**Tutor:** ${s}`;
  const transcript = (...turns: string[]) =>
    [
      "**Tutor (greeting):** Open het gesprek.",
      ...turns.flatMap((t) => [`**Student:** Hoi.`, t]),
    ].join("\n\n");

  it("counts the role turns, not the final feedback turn", () => {
    const feedback = role(`### Wat goed ging\n- ${"woord ".repeat(300)}`);
    expect(COUNTED_CHECKS.longRoleTurn(transcript(role("Ja, oké."), feedback))).toBe(false);
  });

  it("fails a role turn over 100 words or with a list or heading", () => {
    const end = role("### Wat goed ging");
    expect(COUNTED_CHECKS.longRoleTurn(transcript(role("woord ".repeat(101)), end))).toBe(true);
    expect(COUNTED_CHECKS.longRoleTurn(transcript(role("woord ".repeat(95)), end))).toBe(false);
    expect(COUNTED_CHECKS.longRoleTurn(transcript(role("- punt een\n- punt twee"), end))).toBe(
      true,
    );
    expect(
      COUNTED_CHECKS.longRoleTurn(transcript(role("*kijkt naar de grond* Ik weet het niet."), end)),
    ).toBe(false);
  });
});
