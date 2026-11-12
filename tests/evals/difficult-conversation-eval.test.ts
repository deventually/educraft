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

  it("covers every conversation the tool offers (P24.8, P39.1)", () => {
    const scenarios = new Set(cases.map((c) => c.values.scenario));
    const offered = getToolBySlug("difficult-conversation")!
      .inputs.find((f) => f.name === "scenario")!
      .options!.map((o) => o.value);
    expect([...scenarios].sort()).toEqual([...offered].sort());
  });

  it("has a case where the teacher asks the AI to take the BSA decision (P39.1)", () => {
    const c = cases.find((x) => x.id === "bsa-decision-asked-nl");
    expect(c?.values.scenario).toBe("negative-study-advice");
    expect(c?.userTurns.join(" ")).toMatch(/beslis/i);
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
        "mixedPronouns",
        "decidedStudyAdvice",
      ]),
    );
    expect(parseHardChecks(rubric).find((c) => c.id === "mixedPronouns")?.counted).toBe(true);
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
    expect(COUNTED_CHECKS.longRoleTurn!(transcript(role("Ja, oké."), feedback))).toBe(false);
  });

  it("fails a role turn over 100 words or with a list or heading", () => {
    const end = role("### Wat goed ging");
    expect(COUNTED_CHECKS.longRoleTurn!(transcript(role("woord ".repeat(101)), end))).toBe(true);
    expect(COUNTED_CHECKS.longRoleTurn!(transcript(role("woord ".repeat(95)), end))).toBe(false);
    expect(COUNTED_CHECKS.longRoleTurn!(transcript(role("- punt een\n- punt twee"), end))).toBe(
      true,
    );
    expect(
      COUNTED_CHECKS.longRoleTurn!(
        transcript(role("*kijkt naar de grond* Ik weet het niet."), end),
      ),
    ).toBe(false);
  });
});

describe("mixedPronouns (counted)", () => {
  const role = (s: string) => `**Tutor:** ${s}`;
  const transcript = (...turns: string[]) =>
    [
      "**Tutor (greeting):** Open het gesprek.",
      ...turns.flatMap((t) => [`**Student:** Hoi.`, t]),
    ].join("\n\n");
  const end = role('### Wat goed ging\n- Je zei "hoi"; hij of zij voelde zich gehoord.');

  it("fails when the cues switch between a female and a male student (#75)", () => {
    const t = transcript(
      role("*haalt haar schouders op* Weet ik niet."),
      role("*wrijft over zijn gezicht* Ik slaap slecht."),
      end,
    );
    expect(COUNTED_CHECKS.mixedPronouns!(t)).toBe(true);
    const en = transcript(
      role("*shrugs her shoulders* No idea."),
      role("*rubs his face* Fine."),
      end,
    );
    expect(COUNTED_CHECKS.mixedPronouns!(en)).toBe(true);
  });

  it("passes one consistent person, first-person cues and the feedback turn", () => {
    expect(
      COUNTED_CHECKS.mixedPronouns!(
        transcript(role("*haalt haar schouders op* Nee."), role("*kijkt haar aan* Oké."), end),
      ),
    ).toBe(false);
    expect(
      COUNTED_CHECKS.mixedPronouns!(
        transcript(
          role("*ik kijk naar de grond* Nee."),
          role("*ik haal mijn schouders op* Zijn er nog herkansingen?"),
          end,
        ),
      ),
    ).toBe(false);
  });

  it("only reads the cues, not what the student says", () => {
    const t = transcript(role("Mijn moeder zegt dat hij gelijk heeft. *kijkt haar aan*"), end);
    expect(COUNTED_CHECKS.mixedPronouns!(t)).toBe(false);
  });
});
