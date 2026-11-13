/**
 * The eval harness's files on disk: the cases and rubric per tool, and the outputs a run wrote
 * under `evals/output/<date>/<tool>/`. Shared by `scripts/eval.ts` and the Jev judge experiment
 * (`scripts/eval-judge-jev.ts`), so both read the same outputs the same way.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { OutputLanguage, Tool } from "~/lib/registry/types";
import type { EvalCase } from "./eval-helpers";

export const EVALS_DIR = join(process.cwd(), "evals");
export const OUTPUT_DIR = join(EVALS_DIR, "output");
export const REPORTS_DIR = join(EVALS_DIR, "reports");

interface CasesFile {
  cases: EvalCase[];
}

export function loadCases(tool: Tool): EvalCase[] {
  const raw = readFileSync(join(EVALS_DIR, tool.slug, "cases.json"), "utf8");
  const parsed = JSON.parse(raw) as CasesFile;
  if (!Array.isArray(parsed.cases)) throw new Error(`${tool.slug}/cases.json: missing "cases" array`);
  return parsed.cases;
}

export function loadRubric(tool: Tool): string {
  const path = join(EVALS_DIR, tool.slug, "rubric.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

export interface CaseOutput {
  tool: string;
  caseId: string;
  model: string;
  outputLanguage: OutputLanguage;
  promptWords: number;
  output: string;
  /** A model answer hit maxTokens (finishReason "length"): the output is cut off. */
  truncated?: boolean;
}

/** Run 1 keeps the old name, so a single-run measurement looks as before. */
export function outputFileName(caseId: string, run: number): string {
  return run === 1 ? `${caseId}.md` : `${caseId}.run${run}.md`;
}

export function readExistingOutput(date: string, toolId: string, caseId: string, run = 1): CaseOutput | null {
  const path = join(OUTPUT_DIR, date, toolId, outputFileName(caseId, run));
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  const meta = /<!-- tool=(\S+) case=(\S+) model=(\S+) lang=(\S+) promptWords=(\d+) -->/.exec(raw);
  const body = raw.replace(/^<!--.*?-->\n\n/, "");
  return {
    tool: toolId,
    caseId,
    model: meta?.[3] ?? "unknown",
    outputLanguage: (meta?.[4] as OutputLanguage) ?? "nl",
    promptWords: meta ? Number(meta[5]) : 0,
    output: body,
    truncated: / truncated=1 -->/.test(raw),
  };
}

export function latestOutputDate(): string | null {
  if (!existsSync(OUTPUT_DIR)) return null;
  const dates = readdirSync(OUTPUT_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.at(-1) ?? null;
}
