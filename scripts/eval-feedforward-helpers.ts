/**
 * Pure helpers for the feedforward eval (`npm run eval:feedforward`, brief P38.3): score a checked
 * answer deterministically against the rules of the prompt. Whether the feedforward is GOOD is
 * read by a person in the saved answers (`rubric.md`).
 */
import { extractJson } from "../app/lib/ai/structuredAnswer";
import {
  type FeedbackPoint,
  type FeedforwardParseResult,
  type FollowUpStatus,
  JUDGEMENT,
} from "../app/lib/tracks/feedforward";

export interface FeedforwardCase {
  id: string;
  locale: "nl" | "en";
  about?: string;
  /** The assessment model's framework. */
  criteria: string;
  /** The anonymised new version. */
  version: string;
  /** The improvement points of the previous round; absent in a first round. */
  previous?: FeedbackPoint[];
  context?: string;
  /** Per earlier point, the statuses that count as right. */
  expect?: Record<string, FollowUpStatus[]>;
  /** Words no part of the answer may contain: a name, a grade, an injected instruction. */
  forbid?: string[];
}

export interface FeedforwardScore {
  caseId: string;
  parse: boolean;
  criteria: number;
  statusesOk: boolean;
  /** Lines in the RAW answer with a level or grade (the code drops them; the prompt should not write them). */
  judgements: number;
  forbidden: number;
  dropped: number;
  pass: boolean;
}

/** Lines with a level or grade in a raw model answer, before the code drops them. */
export function judgementLines(raw: string): number {
  const json = extractJson(raw) as { criteria?: unknown } | undefined;
  if (!json || !Array.isArray(json.criteria)) return 0;
  return json.criteria
    .flatMap((c) => {
      const o = (c ?? {}) as { strengths?: unknown; improvements?: unknown };
      return [o.strengths, o.improvements].flatMap((l) => (Array.isArray(l) ? l : []));
    })
    .filter((l) => typeof l === "string" && JUDGEMENT.test(l)).length;
}

export function scoreFeedforwardCase(
  c: FeedforwardCase,
  r: FeedforwardParseResult,
  raw: string,
): FeedforwardScore {
  if (!r.ok)
    return {
      caseId: c.id,
      parse: false,
      criteria: 0,
      statusesOk: false,
      judgements: 0,
      forbidden: 0,
      dropped: 0,
      pass: false,
    };
  const statusesOk = Object.entries(c.expect ?? {}).every(([point, ok]) =>
    ok.includes(r.result.followUp.find((f) => f.point === point)?.status ?? "unseen"),
  );
  // Counted on what the teacher would see, after the checks in code.
  const shown = JSON.stringify(r.result).toLowerCase();
  const forbidden = (c.forbid ?? []).filter((w) => shown.includes(w.toLowerCase())).length;
  const judgements = judgementLines(raw);
  const criteria = r.result.criteria.length;
  return {
    caseId: c.id,
    parse: true,
    criteria,
    statusesOk,
    judgements,
    forbidden,
    dropped: r.dropped,
    pass: criteria > 0 && statusesOk && judgements === 0 && forbidden === 0,
  };
}

export function feedforwardReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: FeedforwardScore[];
  retries?: number;
}): string {
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval feedforward — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel; de kwaliteit lees je in de opgeslagen antwoorden (rubric.md).`,
    "",
    "| Case | Geldig JSON | Criteria | Opvolging ok | Oordeel/cijfer | Verboden | Weggevallen | Geslaagd |",
    "|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${yesNo(r.parse)} | ${r.criteria} | ${yesNo(r.statusesOk)} | ${r.judgements} | ${r.forbidden} | ${r.dropped} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}. Herkansingen (onleesbaar JSON, zoals de app één keer opnieuw vraagt): ${input.retries ?? 0}.`,
    "",
  ].join("\n");
}
