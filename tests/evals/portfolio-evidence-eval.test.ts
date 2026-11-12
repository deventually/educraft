import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSortMessage, parseSortAnswer } from "~/lib/portfolio/batch";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import {
  caseDossier,
  type EvidenceEvalFile,
  evidenceReportMarkdown,
  scoreSort,
} from "../../scripts/eval-evidence-helpers";

const dir = join(__dirname, "../../evals/portfolio-evidence");
const suite = JSON.parse(readFileSync(join(dir, "cases.json"), "utf8")) as EvidenceEvalFile;
const rubric = readFileSync(join(dir, "rubric.md"), "utf8");

const score = (id: string, raw: string | null) => {
  const c = suite.cases.find((x) => x.id === id);
  if (!c) throw new Error(id);
  const d = caseDossier(suite, c);
  return scoreSort(suite, c, raw, parseSortAnswer(raw, d, { key: c.id, ...c.file }));
};

describe("portfolio-evidence eval cases", () => {
  it("covers Dutch and English and the failure modes the prompt guards against", () => {
    expect(new Set(suite.cases.map((c) => c.locale))).toEqual(new Set(["nl", "en"]));
    for (const mode of ["own-reflection", "ai-output", "injection", "no-text", "template", "names"])
      expect(
        suite.cases.some((c) => c.id.includes(mode)),
        mode,
      ).toBe(true);
    expect(suite.cases.length).toBeGreaterThanOrEqual(10);
  });

  it("every case builds a valid dossier and a message with its file", () => {
    for (const c of suite.cases) {
      const d = caseDossier(suite, c);
      expect(DossierDataSchema.safeParse(d).success, c.id).toBe(true);
      expect(buildSortMessage(d, c.file, c.locale), c.id).toContain(c.file.name);
    }
  });

  it("the case's known-good answer passes every check", () => {
    for (const c of suite.cases) {
      const s = score(c.id, JSON.stringify(c.good));
      expect(s.pass, `${c.id}: ${JSON.stringify(s.checks)}`).toBe(true);
    }
  });

  it("no usable answer fails", () => {
    expect(score("nl-lesson-plan", null).checks.parse).toBe(false);
    expect(score("nl-lesson-plan", "geen json").pass).toBe(false);
  });

  it("scores a wrong outcome, kind, line, missed doubt and a leaked name", () => {
    const good = suite.cases.find((c) => c.id === "nl-lesson-plan")?.good as Record<
      string,
      unknown
    >;
    const wrong = (patch: Record<string, unknown>) =>
      score("nl-lesson-plan", JSON.stringify({ ...good, ...patch })).checks;
    expect(wrong({ outcome: "U4" }).outcome).toBe(false);
    expect(wrong({ kind: "feedback" }).kind).toBe(false);
    expect(wrong({ required: null }).required).toBe(false);
    const noText = suite.cases.find((c) => c.id.includes("no-text"));
    expect(score(noText!.id, JSON.stringify({ ...noText!.good, sure: true })).checks.doubt).toBe(
      true,
    ); // the code forces a check without text, whatever the AI says
    const names = suite.cases.find((c) => c.id.includes("names"));
    expect(
      score(names!.id, JSON.stringify({ ...names!.good, title: `${names!.expect.forbidden[0]}` }))
        .checks.clean,
    ).toBe(false);
  });

  it("the rubric explains every check, and the report counts them", () => {
    const s = score("nl-lesson-plan", JSON.stringify(suite.cases[0]?.good));
    for (const check of Object.keys(s.checks)) expect(rubric, check).toContain(`**${check}**`);
    const md = evidenceReportMarkdown({
      date: "2026-11-12",
      model: "m",
      repeat: 1,
      rows: [{ caseId: "nl-lesson-plan", ...s }],
    });
    expect(md).toContain("portfolio-evidence-sort@v1");
    expect(md).toContain("1/1");
  });
});
