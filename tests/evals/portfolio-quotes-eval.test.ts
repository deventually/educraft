import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  caseToDossier,
  type QuotesCase,
  quotesReportMarkdown,
  scoreQuotesCase,
} from "../../scripts/eval-quotes-helpers";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "portfolio-quotes", "cases.json"), "utf8"),
).cases as QuotesCase[];

const strong: QuotesCase = {
  id: "t",
  locale: "nl",
  role: "workplace-supervisor",
  criteria: ["De les heeft een heldere opbouw.", "De docent sluit aan bij de beginsituatie."],
  feedback: "Je opende met een vraag en iedereen dacht mee. Goede les!",
  mustQuote: [{ criterion: 1, contains: "opende met een vraag" }],
  mustNot: ["Goede les"],
};

describe("the quotes eval (deterministic scoring)", () => {
  it("has vague and strong feedback, an injection and an English case", () => {
    const ids = cases.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["vague-only", "injection"]));
    expect(cases.some((c) => c.locale === "en")).toBe(true);
    expect(cases.some((c) => (c.maxQuotes ?? 99) === 0)).toBe(true);
    for (const c of cases)
      expect(caseToDossier(c).framework.outcomes[0]?.criteria.length).toBe(c.criteria.length);
  });

  it("passes a quote under the right criterion and nothing vague", () => {
    const d = caseToDossier(strong);
    const c1 = d.framework.outcomes[0]!.criteria[0]!.id;
    const s = scoreQuotesCase(strong, d, {
      quotes: [{ criterionId: c1, text: "Je opende met een vraag en iedereen dacht mee." }],
      dropped: 0,
    });
    expect(s).toMatchObject({ parse: true, found: 1, clean: true, pass: true });
  });

  it("fails a missed quote, a vague one, a dropped one, or too many", () => {
    const d = caseToDossier(strong);
    const [c1, c2] = d.framework.outcomes[0]!.criteria.map((c) => c.id);
    expect(scoreQuotesCase(strong, d, null)).toMatchObject({ parse: false, pass: false });
    expect(
      scoreQuotesCase(strong, d, {
        quotes: [{ criterionId: c2!, text: "Je opende met een vraag en iedereen dacht mee." }],
        dropped: 0,
      }).pass,
    ).toBe(false);
    expect(
      scoreQuotesCase(strong, d, {
        quotes: [
          { criterionId: c1!, text: "Je opende met een vraag en iedereen dacht mee." },
          { criterionId: c1!, text: "Goede les!" },
        ],
        dropped: 0,
      }),
    ).toMatchObject({ clean: false, pass: false });
    expect(
      scoreQuotesCase(strong, d, {
        quotes: [{ criterionId: c1!, text: "Je opende met een vraag en iedereen dacht mee." }],
        dropped: 1,
      }).pass,
    ).toBe(false);
    expect(
      scoreQuotesCase({ ...strong, mustQuote: [], maxQuotes: 0 }, d, {
        quotes: [{ criterionId: c1!, text: "Je opende met een vraag" }],
        dropped: 0,
      }).pass,
    ).toBe(false);
  });

  it("writes a report naming the prompt, the model and each case", () => {
    const md = quotesReportMarkdown({
      date: "2026-11-18",
      model: "claude-code::claude-sonnet-5-5",
      repeat: 1,
      rows: [
        { caseId: "t", parse: true, quotes: 1, dropped: 0, found: 1, clean: true, pass: true },
      ],
    });
    expect(md).toContain("portfolio-quotes@v1");
    expect(md).toContain("claude-code::claude-sonnet-5-5");
    expect(md).toMatch(/\| t \|/);
  });
});
