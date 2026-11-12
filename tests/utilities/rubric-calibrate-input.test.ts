import { describe, expect, it } from "vitest";
import { calibrationTemplate, parseRaterText } from "~/lib/utilities/rubric";
import { sampleRubric } from "./fixtures";

// sampleRubric: Analyse (Onvoldoende/Voldoende/Goed), Bronnen (Ontbreekt/Aanwezig).

describe("parseRaterText", () => {
  it("reads tab-separated rows pasted from Excel: code, then a level per criterion", () => {
    const d = sampleRubric();
    const [analyse, bronnen] = d.criteria;
    const { works, errors } = parseRaterText(d, "A1\tGoed\tAanwezig\nA2\tvoldoende\tontbreekt\n");
    expect(errors).toEqual([]);
    expect(works).toEqual([
      {
        code: "A1",
        choice: { [analyse!.id]: analyse!.levels[2]!.id, [bronnen!.id]: bronnen!.levels[1]!.id },
      },
      {
        code: "A2",
        choice: { [analyse!.id]: analyse!.levels[1]!.id, [bronnen!.id]: bronnen!.levels[0]!.id },
      },
    ]);
  });

  it("skips a header row that starts with 'code', and empty lines", () => {
    const d = sampleRubric();
    const { works, errors } = parseRaterText(d, "Code\tAnalyse\tBronnen\n\n  \nA1\tGoed\tAanwezig");
    expect(errors).toEqual([]);
    expect(works.map((w) => w.code)).toEqual(["A1"]);
  });

  it("reads the semicolon CSV of the template, and commas", () => {
    const d = sampleRubric();
    expect(parseRaterText(d, "code;Analyse;Bronnen\r\nA1;Goed;Aanwezig").works).toHaveLength(1);
    expect(parseRaterText(d, "A1,Goed,Aanwezig").works).toHaveLength(1);
  });

  it("leaves an empty cell open", () => {
    const d = sampleRubric();
    const { works } = parseRaterText(d, "A1\t\tAanwezig");
    expect(Object.keys(works[0]!.choice)).toEqual([d.criteria[1]!.id]);
  });

  it("reports an unknown level with its line and criterion, and keeps the row out", () => {
    const d = sampleRubric();
    const { works, errors } = parseRaterText(
      d,
      "code\tAnalyse\tBronnen\nA1\tPrima\tAanwezig\nA2\tGoed\tAanwezig",
    );
    expect(errors).toEqual([
      { line: 2, kind: "unknownLevel", criterion: "Analyse", value: "Prima" },
    ]);
    expect(works.map((w) => w.code)).toEqual(["A2"]);
  });

  it("reports a row without a code and a row with more columns than criteria", () => {
    const d = sampleRubric();
    const { errors } = parseRaterText(d, "\tGoed\tAanwezig\nA2\tGoed\tAanwezig\tExtra");
    expect(errors).toEqual([
      { line: 1, kind: "noCode", value: "" },
      { line: 2, kind: "tooManyColumns", value: "Extra" },
    ]);
  });
});

describe("calibrationTemplate", () => {
  it("is a semicolon CSV header: code, then the criterion titles; it parses back to nothing", () => {
    const d = sampleRubric();
    const csv = calibrationTemplate(d);
    expect(csv).toBe("code;Analyse;Bronnen\r\n");
    expect(parseRaterText(d, csv)).toEqual({ works: [], errors: [] });
  });

  it("quotes a title with a semicolon or a quote", () => {
    const d = sampleRubric();
    d.criteria[0]!.title = 'Analyse; "diep"';
    expect(calibrationTemplate(d)).toBe('code;"Analyse; ""diep""";Bronnen\r\n');
  });
});
