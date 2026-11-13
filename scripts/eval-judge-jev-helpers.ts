/**
 * An experiment (2026-11-13): the eval judge's hard checks as typed yes/no questions for
 * TypeSafe's Jev, next to the LLM judge that answers them now.
 *
 * Built to TypeSafe's skill (plugin `typesafe@typesafe-ai`) and docs, as for the evidence sort:
 * - Jev judges, code decides: the truth table in `parseJudgeJevAnswer`;
 * - state as named fields (`tool`, `case`, `output`, `about_output`);
 * - one judgment per question: a check is asked per part (`evals/judge-jev/checks.json`) and
 *   fails when one part shows the failure;
 * - a condition on a case field is decided in code, not asked (`when`);
 * - math, counting and exact lookups stay with the LLM judge (`llm`), per TypeSafe's
 *   jaggedness page;
 * - 0.7 / 0.3, the band between unsettled: in a hybrid it goes to the LLM judge;
 * - checks are written once, from the rubric text, and a holdout of tools is never tuned on.
 *
 * Eval only: `npm run eval` keeps its own judge.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loc } from "../app/lib/i18n/localized";
import type { Tool } from "../app/lib/registry/types";
import { JEV_MODEL } from "./eval-evidence-jev-helpers";
import type { EvalCase } from "./eval-helpers";

export const JUDGE_JEV_THRESHOLDS = { yes: 0.7, no: 0.3 } as const;

const When = z.union([
  /** Version 2: the case has a known error (`isKnownErrorCase`). */
  z.object({ knownError: z.literal(true) }),
  z.object({ field: z.string(), empty: z.literal(true) }),
  z.object({ field: z.string(), equals: z.union([z.boolean(), z.string()]) }),
  z.object({ eqf: z.number() }),
]);
type When = z.infer<typeof When>;

const Part = z.object({
  ask: z.string().min(1),
  yes: z.string().min(1),
  no: z.string().min(1),
  /** Which answer means the failure happened. */
  fails: z.enum(["yes", "no"]),
});

const CheckSpec = z.union([
  z.object({ llm: z.string().min(1) }).strict(),
  z.object({ when: When.optional(), parts: z.array(Part).min(1) }).strict(),
]);
type CheckSpec = z.infer<typeof CheckSpec>;

const JudgeSpecs = z.object({
  /** 1: the first set (`checks.json`); 2: with the fixed rules of README "Versie 2". */
  version: z.number().int().default(1),
  about: z.string(),
  holdout: z.array(z.string()),
  /** `<tool slug>/<check id>` → how Jev asks it. */
  checks: z.record(z.string(), CheckSpec),
});
type JudgeSpecs = z.infer<typeof JudgeSpecs>;

export const LATEST_CHECKS = 2;

/** The checks of one version; version 1 stays as it was, so its reports can be rescored. */
export function loadJudgeSpecs(version = LATEST_CHECKS): JudgeSpecs {
  const name = version === 1 ? "checks.json" : `checks.v${version}.json`;
  const specs = JudgeSpecs.parse(
    JSON.parse(readFileSync(join(__dirname, "../evals/judge-jev", name), "utf8")),
  );
  if (specs.version !== version) throw new Error(`${name} is version ${specs.version}`);
  return specs;
}

/**
 * Bastiaan's labels for one report (`<date><label>`): row keys repeat across runs, so a label
 * holds only for the outputs it was given on.
 */
export const labelsPath = (report: string) =>
  join(__dirname, "../evals/judge-jev/labels", `${report}.json`);

/** Version 2, rule 1: a known-error case says so at the start of its description. */
export function isKnownErrorCase(c: Pick<EvalCase, "description">): boolean {
  return /^(known error|bekende fout)\b/i.test(c.description ?? "");
}

/**
 * Version 2, rule 3: an output in stages (`### Stage: <id>` lines, as the eval writes them)
 * as one field per stage, so a check can name the stage it is about. A single text stays a text.
 */
export function outputByStage(output: string): string | Record<string, string> {
  const marker = /^### Stage: (\S+)[ \t]*$/gm;
  if (!/^\s*### Stage: /.test(output)) return output;
  const marks = [...output.matchAll(marker)];
  return Object.fromEntries(
    marks.map((m, i) => [
      m[1] as string,
      output.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? output.length).trim(),
    ]),
  );
}

/**
 * Version 2, rule 4: the same two sentences on every part that fails on yes, after Bastiaan's
 * rule for his labels: a check fails only when the failure demonstrably happens in the output.
 */
export const EVIDENCE_FAILS =
  " Only when the text of `output` itself shows this; a refusal of it or a warning against it is not this.";
export const EVIDENCE_PASSES = " Also when `output` does not clearly show it.";

/** The checks of one tool, in rubric order: `[check id, spec]`. */
function checksOf(specs: JudgeSpecs, slug: string): [string, CheckSpec][] {
  return Object.entries(specs.checks)
    .filter(([k]) => k.startsWith(`${slug}/`))
    .map(([k, v]) => [k.slice(slug.length + 1), v]);
}

function holds(when: When | undefined, c: EvalCase): boolean {
  if (!when) return true;
  if ("knownError" in when) return isKnownErrorCase(c);
  if ("eqf" in when) return c.profile?.eqf === when.eqf;
  const v = c.values?.[when.field];
  if ("empty" in when) return v === undefined || String(v).trim() === "";
  return v === when.equals;
}

interface NoulQuestion {
  type: "noul";
  instructions: string;
  criteria: { true: string; false: string };
}

export interface JudgeJevRequest {
  model: string;
  state: {
    tool: { name: string; does: string; mode: string };
    case: {
      description: string;
      output_language: string;
      eqf: number | null;
      inputs: Record<string, unknown>;
      /** Version 2: the description of a known-error case, else null. */
      known_error?: string | null;
    };
    output: string | Record<string, string>;
    about_output: string;
  };
  questions: Record<string, NoulQuestion>;
}

const ABOUT_OUTPUT =
  "`output` is what the tool produced for `case`. In a chat transcript, a turn marked \"(greeting)\" is fixed app text the model did not write; it never counts for a check.";
const ABOUT_OUTPUT_V2 = `${ABOUT_OUTPUT} A tool that works in stages has its \`output\` by stage: \`output.<stage>\` is that stage's text. \`case.known_error\` is the known error the case was built around, or null for an ordinary case.`;

/** One request per output: every asked part of every check of its tool. */
export function buildJudgeJevRequest(
  input: { tool: Tool; c: EvalCase; output: string },
  specs: JudgeSpecs,
  opts: { model?: string } = {},
): { request: JudgeJevRequest; asked: string[] } {
  const { tool, c, output } = input;
  const v2 = specs.version >= 2;
  const questions: Record<string, NoulQuestion> = {};
  const asked: string[] = [];
  for (const [id, spec] of checksOf(specs, tool.slug)) {
    if ("llm" in spec || !holds(spec.when, c)) continue;
    asked.push(id);
    spec.parts.forEach((part, k) => {
      questions[`${id}_${k + 1}`] = {
        type: "noul",
        instructions: part.ask,
        criteria:
          v2 && part.fails === "yes"
            ? { true: part.yes + EVIDENCE_FAILS, false: part.no + EVIDENCE_PASSES }
            : { true: part.yes, false: part.no },
      };
    });
  }
  return {
    request: {
      model: opts.model ?? JEV_MODEL,
      state: {
        tool: { name: loc(tool.name, "en"), does: loc(tool.tagline, "en"), mode: tool.mode },
        case: {
          description: c.description ?? "",
          output_language: c.outputLanguage,
          eqf: c.profile?.eqf ?? null,
          inputs: c.values ?? {},
          ...(v2 ? { known_error: isKnownErrorCase(c) ? (c.description ?? "") : null } : {}),
        },
        output: v2 ? outputByStage(output) : output,
        about_output: v2 ? ABOUT_OUTPUT_V2 : ABOUT_OUTPUT,
      },
      questions,
    },
    asked,
  };
}

// ── The answer ──────────────────────────────────────────────────────────────

const Response = z.object({
  answers: z.record(z.string(), z.object({ type: z.string(), noul: z.number().optional() })),
  usage: z.object({ cost: z.number().optional() }).partial().optional(),
});

export type JevVerdict = "fail" | "pass" | "unsettled" | "llm";

interface CheckVerdict {
  verdict: JevVerdict;
  /** The highest probability among the parts that the failure happened. */
  p?: number;
  /** `code` when the check's condition on the case decided it, without a question. */
  by?: "code";
}

/**
 * The truth table, per check:
 *
 * | the parts | → |
 * | --- | --- |
 * | the condition on the case does not hold | pass (code) |
 * | the check needs math, counting or a lookup | llm |
 * | one part shows the failure (≥ 0.7) | fail |
 * | every part is clearly no failure (≤ 0.3) | pass |
 * | otherwise (a part in the band, or not answered) | unsettled |
 */
export function parseJudgeJevAnswer(
  body: unknown,
  tool: Pick<Tool, "slug">,
  c: EvalCase,
  specs: JudgeSpecs,
  t: { yes: number; no: number } = JUDGE_JEV_THRESHOLDS,
): { verdicts: Record<string, CheckVerdict>; usable: boolean; costUsd?: number } {
  const parsed = Response.safeParse(body);
  const answers = parsed.success ? parsed.data.answers : {};
  const verdicts: Record<string, CheckVerdict> = {};
  for (const [id, spec] of checksOf(specs, tool.slug)) {
    if ("llm" in spec) {
      verdicts[id] = { verdict: "llm" };
      continue;
    }
    if (!holds(spec.when, c)) {
      verdicts[id] = { verdict: "pass", by: "code" };
      continue;
    }
    const failP = spec.parts.map((part, k) => {
      const a = answers[`${id}_${k + 1}`];
      const p = a?.type === "noul" ? a.noul : undefined;
      return p === undefined ? undefined : part.fails === "yes" ? p : 1 - p;
    });
    const known = failP.filter((p): p is number => p !== undefined);
    const p = known.length ? Math.max(...known) : undefined;
    const verdict: JevVerdict =
      p !== undefined && p >= t.yes
        ? "fail"
        : known.length === failP.length && known.every((x) => x <= t.no)
          ? "pass"
          : "unsettled";
    verdicts[id] = { verdict, ...(p !== undefined ? { p } : {}) };
  }
  const cost = parsed.success ? parsed.data.usage?.cost : undefined;
  return { verdicts, usable: parsed.success, ...(cost !== undefined ? { costUsd: cost } : {}) };
}

// ── The comparison ──────────────────────────────────────────────────────────

export interface JudgeRow {
  tool: string;
  caseId: string;
  run: number;
  check: string;
  holdout: boolean;
  jev: JevVerdict;
  jevP?: number;
  /** The LLM judge failed the check, as the eval applies it (with a quote in the output). */
  sonnet: boolean;
}

export const rowKey = (r: Pick<JudgeRow, "tool" | "caseId" | "run" | "check">) =>
  `${r.tool}/${r.caseId}#${r.run}/${r.check}`;

const settled = (r: JudgeRow) => r.jev === "fail" || r.jev === "pass";
const agrees = (r: JudgeRow) => (r.jev === "fail") === r.sonnet;

/**
 * The hybrid Bastiaan's labels point to (2026-11-13): where the two disagreed, Jev's "fail" was
 * mostly a false alarm and its "pass" held. So Jev's pass stands, and everything else (fail,
 * unsettled, left to the LLM) is the LLM judge's.
 */
const hybridFails = (r: JudgeRow) => (r.jev === "pass" ? false : r.sonnet);

/** Bastiaan's labels (row key → the check failed) on the rows where the two judges disagree. */
export function scoreLabels(
  rows: JudgeRow[],
  labels: Record<string, boolean>,
): { labelled: number; jevRight: number; judgeRight: number; hybridRight: number } {
  let labelled = 0;
  let jevRight = 0;
  let judgeRight = 0;
  let hybridRight = 0;
  for (const r of rows) {
    const truth = labels[rowKey(r)];
    if (truth === undefined || !settled(r)) continue;
    labelled++;
    if ((r.jev === "fail") === truth) jevRight++;
    if (r.sonnet === truth) judgeRight++;
    if (hybridFails(r) === truth) hybridRight++;
  }
  return { labelled, jevRight, judgeRight, hybridRight };
}

/** Per set: the outputs, how many need no LLM call in the hybrid, and the labelled scores. */
function hybridLine(name: string, set: JudgeRow[], labels: Record<string, boolean>): string {
  const outputs = new Map<string, boolean>();
  for (const r of set) {
    const k = `${r.tool}/${r.caseId}#${r.run}`;
    outputs.set(k, (outputs.get(k) ?? true) && r.jev === "pass");
  }
  const clear = [...outputs.values()].filter(Boolean).length;
  const s = scoreLabels(set, labels);
  const of = (n: number) => (s.labelled ? `${n}/${s.labelled}` : "-");
  return `| ${name} | ${outputs.size} | ${clear}/${outputs.size} | ${s.labelled} | ${of(s.jevRight)} | ${of(s.judgeRight)} | ${of(s.hybridRight)} |`;
}

/**
 * A row as it would have come out at stricter thresholds. Only stricter: a fail needs a higher
 * p, a pass a lower one. A looser threshold would settle rows nobody labelled.
 */
function atThresholds(r: JudgeRow, t: { yes: number; no: number }): JudgeRow {
  if (r.jev === "llm" || r.jev === "unsettled") return r;
  if (r.jevP === undefined) return r; // decided in code
  const jev = r.jevP >= t.yes ? "fail" : r.jev === "pass" && r.jevP <= t.no ? "pass" : "unsettled";
  return { ...r, jev };
}

const SWEEP = [
  { yes: 0.7, no: 0.3 },
  { yes: 0.8, no: 0.3 },
  { yes: 0.9, no: 0.3 },
  { yes: 0.95, no: 0.3 },
  { yes: 0.7, no: 0.2 },
  { yes: 0.7, no: 0.1 },
  { yes: 0.7, no: 0.05 },
];

/** Per threshold, on the tuning rows: what Jev decides, its labelled false alarms and misses. */
function sweepLines(rows: JudgeRow[], labels: Record<string, boolean>): string[] {
  return SWEEP.map((t) => {
    const set = rows.map((r) => atThresholds(r, t));
    const decided = set.filter(settled).length;
    const truth = (r: JudgeRow) => labels[rowKey(r)];
    const falseAlarms = set.filter((r) => r.jev === "fail" && truth(r) === false).length;
    const misses = set.filter((r) => r.jev === "pass" && truth(r) === true).length;
    const outputs = new Map<string, boolean>();
    for (const r of set) {
      const k = `${r.tool}/${r.caseId}#${r.run}`;
      outputs.set(k, (outputs.get(k) ?? true) && r.jev === "pass");
    }
    const clear = [...outputs.values()].filter(Boolean).length;
    const fails = set.filter((r) => r.jev === "fail").length;
    return `| ${t.yes.toFixed(2)} | ${t.no.toFixed(2)} | ${decided} | ${fails} | ${falseAlarms} | ${misses} | ${clear}/${outputs.size} |`;
  });
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
const usd = (n: number) => `$${n.toFixed(6)}`;

type Speed = number[] | { mean: number; max: number };

export function judgeJevReport(input: {
  date: string;
  jevModel: string;
  /** The version of `checks.json` the questions came from. */
  checksVersion?: number;
  judgeModel: string;
  rows: JudgeRow[];
  /** Each call's time, or only the mean and maximum (a report rebuilt from an old raw file). */
  jevMs: Speed;
  judgeMs: Speed;
  jevCostUsd?: number;
  judgeCostUsd?: number;
  labels?: Record<string, boolean>;
}): string {
  const { rows } = input;
  const line = (name: string, set: JudgeRow[]) => {
    const s = set.filter(settled);
    const agree = s.filter(agrees).length;
    const unsettled = set.filter((r) => r.jev === "unsettled").length;
    const llm = set.filter((r) => r.jev === "llm").length;
    return `| ${name} | ${s.length} | ${agree}/${s.length} | ${unsettled} | ${llm} |`;
  };
  const speed = (name: string, ms: Speed) => {
    const s = Array.isArray(ms) ? (ms.length ? { mean: mean(ms), max: Math.max(...ms) } : null) : ms;
    return s ? `${name}: gemiddeld ${s.mean} ms, hoogst ${s.max} ms per uitvoer` : "";
  };
  const disagree = rows.filter((r) => settled(r) && !agrees(r));
  return [
    "# Eval — harde checks: Jev naast de LLM-judge",
    "",
    `Datum: ${input.date} · Jev: ${input.jevModel}${input.checksVersion ? ` · checks: v${input.checksVersion}` : ""} · judge: ${input.judgeModel}`,
    "",
    "| Set | Beslist door Jev | Eens met de judge | Onbeslist (naar de judge) | Bij de judge (rekenen, tellen) |",
    "| --- | --- | --- | --- | --- |",
    line(
      "Afstemmen",
      rows.filter((r) => !r.holdout),
    ),
    line(
      "Holdout",
      rows.filter((r) => r.holdout),
    ),
    "",
    [speed("Jev", input.jevMs), speed("Sonnet-judge", input.judgeMs)].filter(Boolean).join(" · "),
    "",
    [
      input.jevCostUsd !== undefined ? `Kosten Jev: ${usd(input.jevCostUsd)}` : "",
      input.judgeCostUsd !== undefined
        ? `Kosten judge: ${usd(input.judgeCostUsd)} (API-lijstprijs)`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
    "",
    ...(input.judgeModel.startsWith("claude-code::")
      ? [
          "Snelheid van de LLM via Claude Code: de model-call zelf, zoals Claude Code hem meet, zonder het opstarten van de CLI. Kosten tegen de API-lijstprijs van hetzelfde model.",
          "",
        ]
      : []),
    ...(input.labels
      ? [
          "## Bastiaans oordeel op de verschillen, en de hybride",
          "",
          "Hybride: zegt Jev bij elke check van een uitvoer \"slaagt\", dan is die uitvoer klaar zonder LLM; anders beoordeelt de LLM-judge hem. Twijfel telt niet mee.",
          "",
          "| Set | Uitvoer | Zonder LLM | Beoordeeld | Jev gelijk | Judge gelijk | Hybride gelijk |",
          "| --- | --- | --- | --- | --- | --- | --- |",
          hybridLine(
            "Afstemmen",
            rows.filter((r) => !r.holdout),
            input.labels,
          ),
          hybridLine(
            "Holdout",
            rows.filter((r) => r.holdout),
            input.labels,
          ),
          "",
          "## Drempels, op alleen de afstemset",
          "",
          "Wat Jev zou beslissen bij een strengere drempel: \"faalt\" pas vanaf een hogere kans, \"slaagt\" pas onder een lagere. Vals alarm en gemist tellen alleen de rijen die Bastiaan beoordeelde (de verschillen bij 0,7 en 0,3); waar Jev en de judge het eens waren, is niets beoordeeld. De holdout telt hier niet mee: daarop wordt geen drempel gekozen.",
          "",
          "| Faalt vanaf | Slaagt tot | Beslist door Jev | Jev zegt faalt | Vals alarm | Gemist | Uitvoer zonder LLM |",
          "| --- | --- | --- | --- | --- | --- | --- |",
          ...sweepLines(
            rows.filter((r) => !r.holdout),
            input.labels,
          ),
          "",
        ]
      : []),
    "## Waar Jev en de judge verschillen",
    "",
    "| Tool | Case | Check | Jev | Judge | p(faalt) | Set |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...disagree.map(
      (r) =>
        `| ${r.tool} | ${r.caseId}#${r.run} | ${r.check} | ${r.jev} | ${r.sonnet ? "fail" : "pass"} | ${r.jevP?.toFixed(2) ?? "-"} | ${r.holdout ? "holdout" : "afstemmen"} |`,
    ),
    "",
  ].join("\n");
}

/** A call's cost in dollars at a `config/models.json` list price; undefined unless in USD. */
type ListPrice = {
  currency: string;
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
};

/**
 * A model's list price from the catalog (`config/models.json`), if it has one. A run through
 * Claude Code ("claude-code::<model>") sends the app's own prompt to that model, so its tokens
 * are priced at that model's list price: what the same call would cost through the API.
 */
export function catalogPrice(model: string): ListPrice | undefined {
  const config = JSON.parse(readFileSync(join(process.cwd(), "config/models.json"), "utf8")) as {
    models: { id: string; price?: ListPrice }[];
  };
  const id = model.replace(/^claude-code::/, "");
  return config.models.find((m) => m.id === id)?.price;
}

export function listPriceUsd(
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
  price: ListPrice | undefined,
): number | undefined {
  if (price?.currency !== "USD") return undefined;
  return (
    (usage.input * price.input +
      usage.cacheRead * (price.cacheRead ?? price.input) +
      usage.cacheWrite * (price.cacheWrite ?? price.input) +
      usage.output * price.output) /
    1_000_000
  );
}
