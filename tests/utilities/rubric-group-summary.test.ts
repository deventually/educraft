import { describe, expect, it } from "vitest";
import { groupSummary, groupSummaryText, rubricRounds, toScore } from "~/lib/utilities/rubric";
import type { RubricData } from "~/lib/utilities/rubric";
import { sampleRubric, uuid } from "./fixtures";

/** P36.1 — de groep in getallen: counted in code, no AI, per round (month). */
const d = sampleRubric();
const [analyse, bronnen] = d.criteria as [RubricData["criteria"][0], RubricData["criteria"][0]];
const fill = (a: number, b: number) =>
  toScore(d, { [analyse.id]: analyse.levels[a]!.id, [bronnen.id]: bronnen.levels[b]!.id })!;
const stored = (month: string, ...levels: ReturnType<typeof fill>[]) =>
  levels.map((l) => ({ month, levels: l }));

describe("rubricRounds", () => {
  it("lists each month with its count, newest first", () => {
    const scores = [...stored("2026-10", fill(0, 0), fill(1, 1)), ...stored("2026-11", fill(2, 1))];
    expect(rubricRounds(scores)).toEqual([
      { month: "2026-11", count: 1 },
      { month: "2026-10", count: 2 },
    ]);
    expect(rubricRounds([])).toEqual([]);
  });
});

describe("groupSummary", () => {
  const round = stored("2026-11", fill(0, 1), fill(0, 1), fill(1, 1), fill(2, 0), fill(1, 1));

  it("counts per level and the share on the lowest level, worst criterion first", () => {
    const s = groupSummary(d, round, "2026-11")!;
    expect(s.month).toBe("2026-11");
    expect(s.total).toBe(5);
    // Analyse: 2 of 5 on the lowest level (40%); Bronnen: 1 of 5 (20%).
    expect(s.criteria.map((c) => c.title)).toEqual(["Analyse", "Bronnen"]);
    expect(s.criteria[0]).toMatchObject({ scored: 5, lowest: 2, lowestPercent: 40 });
    expect(s.criteria[0]!.levels.map((l) => [l.label, l.count])).toEqual([
      ["Onvoldoende", 2],
      ["Voldoende", 2],
      ["Goed", 1],
    ]);
    expect(s.criteria[1]).toMatchObject({ lowest: 1, lowestPercent: 20 });
  });

  it("puts the criterion with most work on the lowest level first, whatever the rubric order", () => {
    const worse = stored("2026-11", ...Array.from({ length: 5 }, () => fill(2, 0)));
    expect(groupSummary(d, worse, "2026-11")!.criteria.map((c) => c.title)).toEqual([
      "Bronnen",
      "Analyse",
    ]);
  });

  it("only counts the chosen round, and shows nothing under five fill-ins", () => {
    const mixed = [...round, ...stored("2026-10", fill(2, 1))];
    expect(groupSummary(d, mixed, "2026-11")!.total).toBe(5);
    expect(groupSummary(d, mixed, "2026-10")).toBeNull();
    expect(groupSummary(d, [], "2026-11")).toBeNull();
  });

  it("leaves out a criterion that was later removed from the rubric", () => {
    const fewer: RubricData = { criteria: [analyse] };
    const s = groupSummary(fewer, round, "2026-11")!;
    expect(s.criteria.map((c) => c.title)).toEqual(["Analyse"]);
  });

  it("counts a criterion added later only over the fill-ins that scored it", () => {
    const extra = {
      id: uuid(),
      title: "Taal",
      levels: [
        { id: uuid(), label: "Zwak", points: 0, description: "" },
        { id: uuid(), label: "Sterk", points: 2, description: "" },
      ],
    };
    const s = groupSummary({ criteria: [...d.criteria, extra] }, round, "2026-11")!;
    expect(s.criteria.find((c) => c.title === "Taal")).toMatchObject({
      scored: 0,
      lowest: 0,
      lowestPercent: 0,
    });
  });
});

describe("groupSummaryText", () => {
  it("gives the counts as text for the prompt, in the chosen language", () => {
    const s = groupSummary(
      d,
      stored("2026-11", fill(0, 1), fill(0, 1), fill(1, 1), fill(2, 0), fill(1, 1)),
      "2026-11",
    )!;
    const nl = groupSummaryText(s, "nl");
    expect(nl).toContain("5 werken");
    expect(nl).toContain("Analyse: 2 van 5 op het laagste niveau (40%)");
    expect(nl).toContain("Onvoldoende 2, Voldoende 2, Goed 1");
    const en = groupSummaryText(s, "en");
    expect(en).toContain("5 pieces of work");
    expect(en).toContain("Analyse: 2 of 5 on the lowest level (40%)");
  });
});

it("keeps the privacy threshold of P23.3 at five fill-ins", async () => {
  const { MIN_SCORES_FOR_INSIGHT } = await import("~/lib/utilities/rubric");
  expect(MIN_SCORES_FOR_INSIGHT).toBe(5);
});
