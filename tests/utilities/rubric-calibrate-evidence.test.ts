import { describe, expect, it } from "vitest";
import {
  CalibrationSummarySchema,
  calibrate,
  calibrationEvidenceText,
  calibrationSummary,
  type RaterWork,
  type RubricData,
} from "~/lib/utilities/rubric";
import { sampleRubric } from "./fixtures";

/** A work scored at level positions (by rubric order) for each criterion. */
function work(data: RubricData, code: string, positions: number[]): RaterWork {
  return {
    code,
    choice: Object.fromEntries(
      positions.map((p, i) => [data.criteria[i]!.id, data.criteria[i]!.levels[p]!.id]),
    ),
  };
}

const OTHER = "00000000-0000-4000-8000-0000000fffff";
const CODES = ["A1-Jan", "A2-Fatima", "A3-Noor", "ALLEEN-1", "ALLEEN-2"];

function sample() {
  const data = sampleRubric();
  const result = calibrate(
    data,
    [
      work(data, CODES[0]!, [2, 1]),
      work(data, CODES[1]!, [1, 1]),
      work(data, CODES[2]!, [2, 0]),
      work(data, CODES[3]!, [0, 0]),
    ],
    [
      work(data, CODES[0]!, [2, 1]),
      work(data, CODES[1]!, [2, 1]),
      work(data, CODES[2]!, [0, 0]),
      work(data, CODES[4]!, [0, 0]),
    ],
  );
  return { data, result };
}

describe("calibration as BKE evidence (P34.3)", () => {
  it("keeps no code of any work in the summary", () => {
    const { result } = sample();
    const summary = calibrationSummary(result);
    const json = JSON.stringify(summary);
    for (const code of CODES) expect(json).not.toContain(code);
    expect(summary.works).toBe(3);
  });

  it("writes the agreement per criterion, the talking points, the date and 'met een collega', without codes", () => {
    const { data, result } = sample();
    const text = calibrationEvidenceText(data, "Eindwerk", calibrationSummary(result), {
      date: "2026-11-19",
      locale: "nl",
    });
    for (const code of CODES) expect(text).not.toContain(code);
    expect(text).toContain("met een collega");
    expect(text).toContain("19 november 2026");
    expect(text).toContain("Eindwerk");
    expect(text).toMatch(/\| Analyse \| 1 van 3 \(33%\) \|/);
    expect(text).toMatch(/\| Bronnen \| 3 van 3 \(100%\) \|/);
    expect(text).toContain("Gesprekspunten");
    expect(text).toMatch(/1\. Analyse: 1 van 3 werken gelijk/);
    // Only criteria are talking points: a work line would need its code.
    expect(text).not.toMatch(/het cijfer verschilt/);
  });

  it("says so when there is nothing to talk about", () => {
    const data = sampleRubric();
    const same = [work(data, "X", [1, 1])];
    const text = calibrationEvidenceText(
      data,
      "Eindwerk",
      calibrationSummary(calibrate(data, same, same)),
      { date: "2026-11-19", locale: "nl" },
    );
    expect(text).toContain("Geen verschillen");
  });

  it("has an English text too", () => {
    const { data, result } = sample();
    const text = calibrationEvidenceText(data, "Final work", calibrationSummary(result), {
      date: "2026-11-19",
      locale: "en",
    });
    expect(text).toContain("with a colleague");
    expect(text).toContain("19 November 2026");
    expect(text).toMatch(/\| Analyse \| 1 of 3 \(33%\) \|/);
  });

  it("parses only numbers and criterion ids, and the text skips an id not in the rubric", () => {
    const { data, result } = sample();
    const summary = calibrationSummary(result);
    const posted = {
      ...summary,
      code: "A1-Jan",
      criteria: [
        ...summary.criteria.map((c) => ({ ...c, code: "A1-Jan" })),
        { id: OTHER, works: 1, exact: 1, oneOff: 0, twoOrMore: 0, kappa: null },
      ],
      talkingPoints: [...summary.talkingPoints, OTHER],
    };
    const parsed = CalibrationSummarySchema.parse(posted);
    expect(JSON.stringify(parsed)).not.toContain("A1-Jan");
    const text = calibrationEvidenceText(data, "Eindwerk", parsed, {
      date: "2026-11-19",
      locale: "nl",
    });
    expect(text).not.toContain(OTHER);
    expect(text.match(/\| 1 van 1 /)).toBeNull();
    expect(CalibrationSummarySchema.safeParse({ ...summary, works: -1 }).success).toBe(false);
    // An id is a rubric's uuid, never free text such as a code or a name.
    expect(
      CalibrationSummarySchema.safeParse({ ...summary, talkingPoints: ["A1 Jan de Vries"] })
        .success,
    ).toBe(false);
  });
});
