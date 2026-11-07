import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ProofreadCase,
  caseToDossier,
  proofreadReportMarkdown,
  scoreProofreadCase,
} from "../../scripts/eval-proofread-helpers";
import { OUTCOME_ID } from "../../scripts/eval-coach-helpers";
import { DossierDataSchema } from "~/lib/portfolio/schema";
import { buildProofreadMessage } from "~/lib/portfolio/proofread";

const cases = JSON.parse(
  readFileSync(join(process.cwd(), "evals", "portfolio-proofread", "cases.json"), "utf8"),
).cases as ProofreadCase[];

describe("portfolio-proofread eval cases", () => {
  it("covers planted errors, a clean chapter, an injection and English", () => {
    const ids = cases.map((c) => c.id);
    for (const id of [
      "planted-errors",
      "clean-chapter",
      "instruction-in-chapter",
      "planted-errors-en",
    ])
      expect(ids).toContain(id);
  });

  it("turns every case into a valid dossier whose planted spans are in the chapter", () => {
    for (const c of cases) {
      const d = caseToDossier(c);
      expect(DossierDataSchema.safeParse(d).success, c.id).toBe(true);
      expect(buildProofreadMessage(d, OUTCOME_ID, c.locale)).toContain("<chapter>");
      for (const f of c.mustFlag ?? []) expect(c.chapter, `${c.id}: ${f.span}`).toContain(f.span);
      for (const k of c.keep ?? []) expect(c.chapter, `${c.id}: ${k}`).toContain(k);
    }
  });
});

describe("scoreProofreadCase", () => {
  const c: ProofreadCase = {
    id: "t",
    locale: "nl",
    chapter: "De studenten werkte hard. Ik gaf de les in week 4.",
    references: [],
    mustFlag: [{ span: "studenten werkte", fix: ["werkten"] }],
    keep: ["week 4"],
    maxSuggestions: 2,
  };
  const ok = (suggestions: { quote: string; suggestion: string }[], dropped = 0) => ({
    ok: true as const,
    dropped,
    suggestions: suggestions.map((s) => ({ ...s, issue: "grammar" as const, explanation: "" })),
  });

  it("passes when the planted error is found and fixed, and nothing else is touched", () => {
    expect(
      scoreProofreadCase(
        c,
        ok([{ quote: "De studenten werkte hard.", suggestion: "De studenten werkten hard." }]),
      ),
    ).toMatchObject({ parse: true, found: 1, fixed: 1, dropped: 0, keptIntact: true, pass: true });
  });

  it("fails a miss, a wrong fix, a dropped quote, a changed fact or too many proposals", () => {
    expect(scoreProofreadCase(c, ok([])).pass).toBe(false);
    expect(
      scoreProofreadCase(
        c,
        ok([{ quote: "De studenten werkte hard.", suggestion: "Studenten werkte hard." }]),
      ).pass,
    ).toBe(false);
    const fix = { quote: "De studenten werkte hard.", suggestion: "De studenten werkten hard." };
    expect(scoreProofreadCase(c, ok([fix], 1)).pass).toBe(false);
    expect(
      scoreProofreadCase(
        c,
        ok([fix, { quote: "Ik gaf de les in week 4.", suggestion: "Ik gaf de les in week 5." }]),
      ).keptIntact,
    ).toBe(false);
    expect(scoreProofreadCase(c, ok([fix, fix, fix])).pass).toBe(false);
    expect(scoreProofreadCase(c, { ok: false, error: "unparseable" }).pass).toBe(false);
  });

  it("writes a report with one row per case", () => {
    const row = scoreProofreadCase(c, ok([]));
    const md = proofreadReportMarkdown({ date: "2026-11-07", model: "m", repeat: 1, rows: [row] });
    expect(md).toContain("| t |");
    expect(md).toContain("Geslaagd: 0 van 1.");
  });
});
