/**
 * Pure helpers for the course-import eval (`npm run eval:import`, brief P26
 * 26.3): score a checked import deterministically against a fictional document
 * whose content is known. The hard checks of the brief: valid JSON, nothing
 * invented, everything verbatim.
 */
import { type BloomLevel, bloomRank } from "../app/lib/courses/bloom";
import type { ImportParseResult } from "../app/lib/courses/import";
import type { AssessmentKind, Grading } from "../app/lib/courses/types";
import { normalizeForMatch } from "../app/lib/documents/locate";

export interface ImportCase {
  id: string;
  locale: "nl" | "en";
  description?: string;
  courseName?: string;
  /** A self-written, fictional document (never a real OER: the repo is public). */
  document: string;
  /** Every learning outcome of the course, verbatim; nothing else may come out. */
  expectOutcomes: string[];
  /** Words no outcome may contain (another course, an injected instruction). */
  forbidOutcomes?: string[];
  /** Words no assessment title may contain. */
  forbidAssessments?: string[];
  /** A vague verb: the Bloom proposal is empty or at most this level. */
  noBloomHigherThan?: Record<string, BloomLevel>;
  /** Each must match one assessment: title contains the word, and the given fields are equal. */
  expectAssessments?: { title: string; week?: number; weight?: number; kind?: AssessmentKind }[];
  expectWeightsOff?: boolean;
  /** From a test blueprint or marking model (course-import@v2): what must come out. */
  expectDocument?: {
    module?: { code?: string; studyYear?: string };
    /** Each must be a success criterion of some outcome (text contains it). */
    criteria?: string[];
    /** Some assessment has this pass mark and grading. */
    passMark?: number;
    grading?: Grading;
    /** Each must match a part of some assessment: title contains the word, fields equal. */
    parts?: { title: string; weight?: number; knockOut?: boolean }[];
  };
}

export interface ImportScore {
  caseId: string;
  parse: boolean;
  /** Share of the expected outcomes found. */
  found: number;
  /** Outcomes that match no expected outcome (invented or from another course). */
  extra: number;
  /** Outcomes, criteria and parts the code marked as not verbatim in the document. */
  unverified: number;
  /** Outcomes or assessments that contain a forbidden word. */
  forbidden: number;
  /** Share of the expected assessments found with the right fields. */
  assessments: number;
  bloomOk: boolean;
  weightsOk: boolean;
  /** Everything the case expects from a test blueprint or marking model came out. */
  documentOk: boolean;
  pass: boolean;
}

const comparable = (s: string) => normalizeForMatch(s).replace(/[.;:,]$/, "");
const lower = (s: string) => s.toLowerCase();

export function scoreImportCase(c: ImportCase, result: ImportParseResult): ImportScore {
  if (!result.ok)
    return {
      caseId: c.id,
      parse: false,
      found: 0,
      extra: 0,
      unverified: 0,
      forbidden: 0,
      assessments: 0,
      bloomOk: false,
      weightsOk: false,
      documentOk: false,
      pass: false,
    };
  const { outcomes, assessments, weightsOff } = result.proposal;
  const matchesExpected = (text: string, expected: string) =>
    comparable(text).includes(comparable(expected));

  const found =
    c.expectOutcomes.filter((e) => outcomes.some((o) => matchesExpected(o.text, e))).length /
    Math.max(1, c.expectOutcomes.length);
  const extra = outcomes.filter((o) => !c.expectOutcomes.some((e) => matchesExpected(o.text, e)))
    .length;
  const unverified =
    outcomes.filter((o) => !o.verbatim).length +
    outcomes.flatMap((o) => o.criteria).filter((k) => !k.verbatim).length +
    assessments.flatMap((a) => a.parts).filter((p) => !p.verbatim).length;
  const forbidden =
    outcomes.filter((o) => (c.forbidOutcomes ?? []).some((w) => lower(o.text).includes(lower(w))))
      .length +
    assessments.filter((a) =>
      (c.forbidAssessments ?? []).some((w) => lower(a.title).includes(lower(w))),
    ).length;

  const expectedA = c.expectAssessments ?? [];
  const metA = expectedA.filter((e) =>
    assessments.some(
      (a) =>
        lower(a.title).includes(lower(e.title)) &&
        (e.week === undefined || a.week === e.week) &&
        (e.weight === undefined || a.weight === e.weight) &&
        (e.kind === undefined || a.kind === e.kind),
    ),
  ).length;
  const assessmentShare = expectedA.length ? metA / expectedA.length : 1;

  const bloomOk = Object.entries(c.noBloomHigherThan ?? {}).every(([text, max]) => {
    const o = outcomes.find((x) => matchesExpected(x.text, text));
    return !o?.bloom || bloomRank(o.bloom) <= bloomRank(max);
  });
  const weightsOk = c.expectWeightsOff === undefined || weightsOff === c.expectWeightsOff;
  const documentOk = scoreDocument(c.expectDocument, result.proposal);

  return {
    caseId: c.id,
    parse: true,
    found,
    extra,
    unverified,
    forbidden,
    assessments: assessmentShare,
    bloomOk,
    weightsOk,
    documentOk,
    pass:
      found === 1 &&
      extra === 0 &&
      unverified === 0 &&
      forbidden === 0 &&
      assessmentShare === 1 &&
      bloomOk &&
      weightsOk &&
      documentOk,
  };
}

type Proposal = Extract<ImportParseResult, { ok: true }>["proposal"];

function scoreDocument(e: ImportCase["expectDocument"], p: Proposal): boolean {
  if (!e) return true;
  const moduleOk = Object.entries(e.module ?? {}).every(
    ([k, v]) => p.module?.[k as "code" | "studyYear"] === v,
  );
  const criteria = p.outcomes.flatMap((o) => o.criteria.map((k) => comparable(k.text)));
  const criteriaOk = (e.criteria ?? []).every((t) =>
    criteria.some((k) => k.includes(comparable(t))),
  );
  const detailsOk =
    (e.passMark === undefined && e.grading === undefined) ||
    p.assessments.some(
      (a) =>
        (e.passMark === undefined || a.details.passMark === e.passMark) &&
        (e.grading === undefined || a.details.grading === e.grading),
    );
  const parts = p.assessments.flatMap((a) => a.parts);
  const partsOk = (e.parts ?? []).every((x) =>
    parts.some(
      (q) =>
        lower(q.title).includes(lower(x.title)) &&
        (x.weight === undefined || q.weight === x.weight) &&
        (x.knockOut === undefined || !!q.knockOut === x.knockOut),
    ),
  );
  return moduleOk && criteriaOk && detailsOk && partsOk;
}

export function importReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: ImportScore[];
}): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval OER-import — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "| Case | Geldig JSON | Leeruitkomsten gevonden | Extra | Niet letterlijk | Verboden | Toetsen goed | Bloom ok | Weging ok | Toetsdocument ok | Geslaagd |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${pct(r.found)} | ${r.extra} | ${r.unverified} | ${r.forbidden} | ${pct(r.assessments)} | ${yesNo(r.bloomOk)} | ${yesNo(r.weightsOk)} | ${yesNo(r.documentOk)} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
