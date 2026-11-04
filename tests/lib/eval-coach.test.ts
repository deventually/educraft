import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CoachCase,
  OUTCOME_ID,
  caseToDossier,
  coachReportMarkdown,
  criterionId,
  leakedNames,
  scoreCoachCase,
} from "../../scripts/eval-coach-helpers";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { buildCoachMessage } from "~/lib/portfolio/coach";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "portfolio-coach", "cases.json"), "utf8"),
).cases as CoachCase[];

describe("portfolio-coach eval cases", () => {
  it("has the failure modes the brief asks for", () => {
    const ids = cases.map((c) => c.id);
    for (const id of [
      "strong-chapter",
      "suggested-only",
      "only-in-appendix",
      "missing-required-evidence",
    ])
      expect(ids).toContain(id);
  });

  it("turns every case into a valid dossier and a coach message", () => {
    for (const c of cases) {
      const d = caseToDossier(c);
      expect(DossierDataSchema.safeParse(d).success, c.id).toBe(true);
      expect(buildCoachMessage(d, OUTCOME_ID, c.locale)).toContain("<chapter>");
      expect(Object.keys(c.expected).length, c.id).toBe(c.dossier.outcome.criteria.length);
    }
  });
});

describe("scoreCoachCase", () => {
  const c = cases.find((x) => x.id === "missing-required-evidence") as CoachCase;
  const review = (over: Record<string, unknown> = {}) => ({
    ok: true as const,
    review: {
      overall: "",
      criteria: [
        {
          criterionId: criterionId(1),
          verdict: "partial" as const,
          strengthen: [],
          evidenceNeeded: ["Feedback van de werkplekbegeleider"],
          ...over,
        },
      ],
    },
  });

  it("passes an acceptable verdict with the required evidence named", () => {
    expect(scoreCoachCase(c, review())).toMatchObject({
      parse: true,
      verdicts: 1,
      evidenceNeeded: true,
      pass: true,
    });
  });

  it("fails a wrong verdict, an unverified quote or missing evidence advice", () => {
    expect(scoreCoachCase(c, review({ verdict: "missing" })).pass).toBe(false);
    expect(scoreCoachCase(c, review({ quoteUnverified: true })).pass).toBe(false);
    expect(scoreCoachCase(c, review({ evidenceNeeded: [] })).pass).toBe(false);
  });

  it("fails an unparseable answer", () => {
    expect(scoreCoachCase(c, { ok: false, error: "unparseable" })).toMatchObject({
      parse: false,
      pass: false,
    });
  });
});

describe("private eval cases stay private", () => {
  it("evals/ holds no file whose name is in EVALS_PRIVATE_DIR", () => {
    const dir = process.env.EVALS_PRIVATE_DIR ?? "";
    expect(leakedNames(dir, join(process.cwd(), "evals"))).toEqual([]);
  });

  it("detects a leaked file by name", () => {
    const priv = mkdtempSync(join(tmpdir(), "priv-"));
    const repo = mkdtempSync(join(tmpdir(), "repo-"));
    mkdirSync(join(repo, "portfolio-coach"));
    writeFileSync(join(priv, "bastiaan-lu1.json"), "{}");
    writeFileSync(join(repo, "portfolio-coach", "bastiaan-lu1.json"), "{}");
    writeFileSync(join(repo, "portfolio-coach", "cases.json"), "{}");
    expect(leakedNames(priv, repo)).toEqual(["bastiaan-lu1.json"]);
  });

  it("reports private cases by id and scores only", () => {
    const md = coachReportMarkdown({
      date: "2026-11-04",
      model: "m",
      repeat: 1,
      rows: [
        {
          caseId: "p1",
          private: true,
          parse: true,
          verdicts: 1,
          unverifiedQuotes: 0,
          evidenceNeeded: null,
          noQuotes: null,
          pass: true,
        },
      ],
    });
    expect(md).toContain("| p1 | ja |");
    expect(md).not.toContain("description");
  });
});
