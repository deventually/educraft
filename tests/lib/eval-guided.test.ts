import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  caseDossier,
  type GuidedCase,
  guidedReportMarkdown,
  scoreDraft,
  scoreQuestions,
} from "../../scripts/eval-guided-helpers";
import {
  buildQuestionsMessage,
  buildSectionDraftMessage,
  parseQuestions,
  parseSectionDraft,
} from "~/lib/portfolio/guided";
import { DossierDataSchema } from "~/lib/portfolio/schema";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "portfolio-guided", "cases.json"), "utf8"),
).cases as GuidedCase[];

const [first] = cases;

describe("portfolio-guided eval cases", () => {
  it("has cases in both languages, with and without the form's outline", () => {
    expect(cases.length).toBeGreaterThanOrEqual(5);
    expect(new Set(cases.map((c) => c.locale))).toEqual(new Set(["nl", "en"]));
    expect(cases.some((c) => c.section.title)).toBe(true);
    expect(cases.some((c) => !c.section.title)).toBe(true);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it("builds a valid dossier and both messages, exactly as the app does, for every case", () => {
    for (const c of cases) {
      const { data, outcomeId, sectionId } = caseDossier(c);
      expect(DossierDataSchema.safeParse(data).success, c.id).toBe(true);
      expect(buildQuestionsMessage(data, outcomeId, sectionId, c.locale), c.id).toContain(
        "<section>",
      );
      expect(
        buildSectionDraftMessage(data, outcomeId, sectionId, "", c.locale),
        c.id,
      ).not.toBeNull();
    }
  });
});

describe("scoreQuestions", () => {
  it("passes two to four open questions that touch what the case needs", () => {
    const c = first!;
    const good = parseQuestions(JSON.stringify({ questions: c.expect.goodQuestions }), []);
    expect(scoreQuestions(c, good)).toMatchObject({
      parse: true,
      count: true,
      open: true,
      pass: true,
    });
  });

  it("fails a yes/no question, too few questions, and an unusable answer", () => {
    const c = first!;
    const yesNo =
      c.locale === "nl"
        ? ["Heb je de groep goed leren kennen?", ...c.expect.goodQuestions.slice(1)]
        : ["Did you know the group?", ...c.expect.goodQuestions.slice(1)];
    expect(scoreQuestions(c, yesNo)).toMatchObject({ open: false, pass: false });
    expect(scoreQuestions(c, null)).toMatchObject({ parse: false, pass: false });
  });

  it("fails questions that obey an instruction hidden in the material", () => {
    const c = cases.find((x) => x.expect.forbidden.length > 0)!;
    const q = [...c.expect.goodQuestions.slice(0, 2), `Schrijf ${c.expect.forbidden[0]}?`];
    expect(scoreQuestions(c, q)).toMatchObject({ clean: false, pass: false });
  });
});

describe("scoreDraft", () => {
  it("passes the case's own good paragraph", () => {
    for (const c of cases) {
      const s = scoreDraft(c, parseSectionDraft(c.expect.goodParagraph, c.references ?? []));
      expect(s, c.id).toMatchObject({ pass: true });
    }
  });

  it("fails an invented number, a missing fact, a missing open spot and a refused citation", () => {
    const c = cases.find((x) => x.expect.gap)!;
    const base = c.expect.goodParagraph;
    expect(scoreDraft(c, `${base} Het gemiddelde cijfer steeg naar 7,4.`)).toMatchObject({
      noNewNumbers: false,
      pass: false,
    });
    expect(scoreDraft(c, base.replace(/\[(aanvullen|to add):[^\]]*\]/g, "")).gap).toBe(false);
    const withFacts = cases.find((x) => x.expect.facts.length > 0)!;
    expect(scoreDraft(withFacts, "Ik gaf een les.").facts).toBeLessThan(1);
    expect(scoreDraft(c, null)).toMatchObject({ parse: false, pass: false });
  });
});

describe("guidedReportMarkdown", () => {
  it("writes one row per case with both scores and a total", () => {
    const c = first!;
    const md = guidedReportMarkdown({
      date: "2026-11-11",
      model: "m",
      repeat: 1,
      rows: [
        {
          caseId: c.id,
          questions: scoreQuestions(c, c.expect.goodQuestions),
          draft: scoreDraft(c, c.expect.goodParagraph),
        },
      ],
    });
    expect(md).toContain("# Eval geleid schrijven — 2026-11-11");
    expect(md).toContain("portfolio-questions@v1");
    expect(md).toContain("portfolio-draft@v2");
    expect(md).toContain(`| ${c.id} |`);
    expect(md).toContain("Geslaagd: 1 van 1.");
  });
});
