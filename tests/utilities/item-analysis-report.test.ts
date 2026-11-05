import { describe, expect, it } from "vitest";
import { analyse, parseScores } from "~/lib/utilities/item-analysis";
import { analysisMarkdown, type ReportLabels } from "~/lib/utilities/item-analysis/report";
import { nl } from "~/lib/i18n/messages/nl";
import { en } from "~/lib/i18n/messages/en";

/**
 * The numbers the tool gets (P24.5): a Markdown summary built in code from the analysis. Only
 * statistics per question go out; never a row, a name or a single candidate's score.
 */
const parsed = parseScores(
  "Naam\tV1\tV2\tV3\nAnna\t1\t1\t1\nBram\t1\t1\t\nCem\t1\t0\t0\nDewi\t0\t0\t0",
);
if (!parsed.ok) throw new Error("fixture");
const stats = analyse(parsed.table);
const notes = { blanks: parsed.blanks, maxFromData: parsed.maxFromData };
const labels = (l: { utilities: { itemAnalysis: { report: ReportLabels } } }) =>
  l.utilities.itemAnalysis.report;

describe("analysisMarkdown", () => {
  const md = analysisMarkdown(stats, notes, labels(nl), "nl");

  it("lists the test as a whole, with a decimal comma in Dutch", () => {
    expect(md).toContain("Kandidaten: 4");
    expect(md).toContain("Vragen: 3");
    expect(md).toContain("Cronbachs alfa: 0,75");
    expect(md).toContain("Gemiddelde totaalscore: 1,50 van 3 (sd 1,29)");
  });

  it("gives one table row per question with p, Rit, Rir and alpha without it", () => {
    expect(md).toContain("| Vraag | Max | p | Rit | Rir | Alfa zonder deze vraag |");
    expect(md).toContain("| V1 | 1 | 0,75 | 0,77 | 0,52 | 0,73 |");
  });

  it("says how blanks and maxima were handled, so the explanation can mention it", () => {
    expect(md).toContain("Lege cellen, geteld als 0 punten: 1");
    expect(md).toContain("hoogste behaalde score");
  });

  it("never contains a name or a candidate's row", () => {
    expect(md).not.toContain("Anna");
    expect(md).not.toContain("Naam");
  });

  it("writes English with a decimal point", () => {
    const e = analysisMarkdown(stats, notes, labels(en), "en");
    expect(e).toContain("Cronbach's alpha: 0.75");
    expect(e).toContain("| Question | Max | p | Rit | Rir | Alpha without this question |");
    expect(e).toContain("| V1 | 1 | 0.75 | 0.77 | 0.52 | 0.73 |");
  });

  it("shows a dash where a number cannot be computed", () => {
    const flat = analyse({
      items: ["a", "b"],
      maxPoints: [1, 1],
      scores: [
        [1, 1],
        [1, 0],
        [1, 0],
      ],
    });
    const m = analysisMarkdown(flat, { blanks: 0, maxFromData: false }, labels(nl), "nl");
    expect(m).toContain("| a | 1 | 1,00 | – | – | – |");
    expect(m).not.toContain("Lege cellen");
    expect(m).not.toContain("hoogste behaalde score");
  });
});
