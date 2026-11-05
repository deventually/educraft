/**
 * Pure helpers for the role-agent eval (`npm run eval:agents`, brief P21 21.2):
 * score a checked review deterministically against a course whose fault is known.
 */
import { extractJson } from "../app/lib/ai/structuredAnswer";
import type { AgentParseResult } from "../app/lib/agents/filter";
import { courseKeys } from "../app/lib/agents/input";
import { RawAgentReviewSchema } from "../app/lib/agents/schema";
import type { LinkedWorkInput } from "../app/lib/agents/input";
import type { RejectedFinding } from "../app/lib/agents/types";
import type { CourseData } from "../app/lib/courses/types";

/** A finding that matches: about one of `targets` (any target when absent) and naming one of `anyOf`. */
export interface FindingExpectation {
  targets?: string[];
  anyOf: string[];
}

export interface AgentCase {
  id: string;
  agent: string;
  locale: "nl" | "en";
  description?: string;
  course: CourseData;
  rejected?: RejectedFinding[];
  /** Linked test questions (P21.7): the case then reviews "also the linked work". */
  linkedWork?: LinkedWorkInput[];
  /** Each expectation must be met by at least one finding (the known fault). */
  mustFind?: FindingExpectation[];
  /** No finding may meet these (rejected advice, an injected instruction). */
  mustNotFind?: FindingExpectation[];
  /** At most this many `warning` findings (0 for a clean course: do not nitpick). */
  maxWarnings?: number;
}

export interface AgentScore {
  caseId: string;
  agent: string;
  parse: boolean;
  /** Share of `mustFind` expectations met. */
  found: number;
  /** Findings that meet a `mustNotFind` expectation. */
  forbidden: number;
  warnings: number;
  /** Keys in the raw answer that the course does not have (dropped by the filter). */
  unknownTargets: number;
  pass: boolean;
}

type Finding = Extract<AgentParseResult, { ok: true }>["findings"][number];

function matches(f: Finding, e: FindingExpectation): boolean {
  if (e.targets?.length && !(f.targetId && e.targets.includes(f.targetId))) return false;
  const text = `${f.message} ${f.suggestion}`.toLowerCase();
  return e.anyOf.some((word) => text.includes(word.toLowerCase()));
}

export function unknownTargets(raw: string, course: CourseData): number {
  const parsed = RawAgentReviewSchema.safeParse(extractJson(raw));
  if (!parsed.success) return 0;
  const keys = courseKeys(course);
  return parsed.data.findings.filter((f) => f.target?.trim() && !Object.hasOwn(keys, f.target.trim()))
    .length;
}

export function scoreAgentCase(c: AgentCase, result: AgentParseResult, unknown: number): AgentScore {
  if (!result.ok)
    return {
      caseId: c.id,
      agent: c.agent,
      parse: false,
      found: 0,
      forbidden: 0,
      warnings: 0,
      unknownTargets: unknown,
      pass: false,
    };
  const must = c.mustFind ?? [];
  const met = must.filter((e) => result.findings.some((f) => matches(f, e))).length;
  const found = must.length ? met / must.length : 1;
  const forbidden = result.findings.filter((f) => (c.mustNotFind ?? []).some((e) => matches(f, e)))
    .length;
  const warnings = result.findings.filter((f) => f.severity === "warning").length;
  const warningsOk = c.maxWarnings === undefined || warnings <= c.maxWarnings;
  return {
    caseId: c.id,
    agent: c.agent,
    parse: true,
    found,
    forbidden,
    warnings,
    unknownTargets: unknown,
    pass: found === 1 && forbidden === 0 && warningsOk && unknown === 0,
  };
}

export function agentReportMarkdown(input: {
  date: string;
  model: string;
  repeat: number;
  rows: AgentScore[];
}): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const yesNo = (b: boolean) => (b ? "ja" : "nee");
  return [
    `# Eval rolagenten — ${input.date}`,
    "",
    `Model: ${input.model}. Herhalingen per case: ${input.repeat}. Deterministische score, geen beoordelaarsmodel.`,
    "",
    "| Case | Pet | Geparsed | Fout gevonden | Verboden bevindingen | Waarschuwingen | Onbekende items | Geslaagd |",
    "|---|---|---|---|---|---|---|---|",
    ...input.rows.map(
      (r) =>
        `| ${r.caseId} | ${r.agent} | ${yesNo(r.parse)} | ${pct(r.found)} | ${r.forbidden} | ${r.warnings} | ${r.unknownTargets} | ${yesNo(r.pass)} |`,
    ),
    "",
    `Geslaagd: ${input.rows.filter((r) => r.pass).length} van ${input.rows.length}.`,
    "",
  ].join("\n");
}
