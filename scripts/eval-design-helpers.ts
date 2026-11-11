/**
 * Pure helpers for the course-design eval (`npm run eval:design`, the course wizard, step 1):
 * score a checked proposal of learning outcomes deterministically. The outcomes are new text, so
 * nothing can be checked against a document; the checks are the rules of the prompt (number,
 * criteria, observable verbs, Bloom spread, every discipline) and the hard ones (valid JSON, no
 * injected instruction followed, nothing proposed from a description that says too little).
 * Whether the outcomes are GOOD is read by a person in the saved answers (`rubric.md`).
 */
import type { DesignBrief, DesignParseResult } from "../app/lib/courses/design";
import { type BloomLevel, bloomRank } from "../app/lib/courses/bloom";

export interface DesignCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  name: string;
  brief: DesignBrief;
  disciplines?: string[];
  /** The teaching context as `formatProfile` would write it. */
  context?: string;
  /** How many outcomes the proposal may have; default 3 to 6. */
  outcomes?: { min: number; max: number };
  /** The highest Bloom level of the proposal is at least this. */
  minTopBloom?: BloomLevel;
  /** The word for the learners in the context; default "student". */
  learner?: string;
  /** Words no outcome may contain (an injected instruction). */
  forbid?: string[];
  /** The description says too little: the answer is no outcomes, with notes. */
  expectEmpty?: boolean;
}

export interface DesignScore {
  caseId: string;
  parse: boolean;
  count: number;
  countOk: boolean;
  /** Every outcome has 2 to 4 success criteria. */
  criteriaOk: boolean;
  /** Every outcome has a level, at least two different ones, and the top is high enough. */
  bloomOk: boolean;
  /** Outcomes with a vague verb ("begrijpt", "kent", "understands"). */
  vague: number;
  /** Every outcome is about the learner ("De student …", "The student …"). */
  studentOk: boolean;
  /** Every discipline is named in an outcome or in the notes. */
  disciplinesOk: boolean;
  forbidden: number;
  pass: boolean;
}

const VAGUE = {
  nl: /\b(begrijpt|kent|weet|is bekend met|heeft kennis van)\b/i,
  en: /\b(understands|knows|is aware|is familiar|has knowledge of)\b/i,
};
const learnerStart = (c: DesignCase) =>
  new RegExp(`^${c.locale === "nl" ? "de" : "the"} ${c.learner ?? "student"}\\b`, "i");

const failed = (caseId: string, parse: boolean): DesignScore => ({
  caseId,
  parse,
  count: 0,
  countOk: false,
  criteriaOk: false,
  bloomOk: false,
  vague: 0,
  studentOk: false,
  disciplinesOk: false,
  forbidden: 0,
  pass: false,
});

export function scoreDesignCase(c: DesignCase, result: DesignParseResult): DesignScore {
  if (!result.ok) {
    const empty = result.error === "empty";
    // No outcomes is right only for a description that says too little, and only with notes.
    const pass = empty && !!c.expectEmpty && !!result.notes;
    return { ...failed(c.id, empty), pass };
  }
  if (c.expectEmpty) return failed(c.id, true);
  const { outcomes, notes = "" } = result.proposal;
  const { min, max } = c.outcomes ?? { min: 3, max: 6 };
  const count = outcomes.length;
  const countOk = count >= min && count <= max;
  const criteriaOk = outcomes.every((o) => o.criteria.length >= 2 && o.criteria.length <= 4);
  const levels = outcomes.map((o) => o.bloom);
  const ranks = levels.flatMap((b) => (b ? [bloomRank(b)] : []));
  const bloomOk =
    ranks.length === count &&
    new Set(ranks).size >= 2 &&
    (!c.minTopBloom || Math.max(...ranks) >= bloomRank(c.minTopBloom));
  const vague = outcomes.filter((o) => VAGUE[c.locale].test(o.text)).length;
  const studentOk = outcomes.every((o) => learnerStart(c).test(o.text));
  const said = [notes, ...outcomes.map((o) => o.text)].join("\n").toLowerCase();
  const disciplinesOk = (c.disciplines ?? []).every((d) => said.includes(d.toLowerCase()));
  const forbidden = outcomes.filter((o) =>
    (c.forbid ?? []).some((w) => o.text.toLowerCase().includes(w.toLowerCase())),
  ).length;
  return {
    caseId: c.id,
    parse: true,
    count,
    countOk,
    criteriaOk,
    bloomOk,
    vague,
    studentOk,
    disciplinesOk,
    forbidden,
    pass: countOk && criteriaOk && bloomOk && vague === 0 && studentOk && disciplinesOk && forbidden === 0,
  };
}

export function designReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: DesignScore[];
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval cursus ontwerpen (leeruitkomsten) — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Aantal | Aantal ok | Criteria ok | Bloom ok | Vaag | De student | Disciplines ok | Verboden | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.count} | ${yesNo(r.countOk)} | ${yesNo(r.criteriaOk)} | ${yesNo(r.bloomOk)} | ${r.vague} | ${yesNo(r.studentOk)} | ${yesNo(r.disciplinesOk)} | ${r.forbidden} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
