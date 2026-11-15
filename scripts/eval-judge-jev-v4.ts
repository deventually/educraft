/**
 * Version 4 of Jev as judge (README "Versie 4"): the five scores of the eval judge, 1 to 5 per
 * dimension, from small questions, after TypeSafe's skill (commit 302eea6) and live docs:
 * - judgments from Jev, the decision in code: per dimension the parts are averaged on a 0 to 1
 *   scale and mapped to 1 to 5 with equal weights (the pattern "composite scoring");
 * - one judgment per question: a dimension of the rubric is cut into its parts, each a Score
 *   (levels described as situations) or a Noul, each naming its rubric sentence (`source`);
 * - code where code can: headings, the closing sentence, length, turn rules (`codeValue`), and
 *   the rubric's caps ("missing a named known error caps this criterion at 2");
 * - the state with named fields, only the case fields a question names (`needs`), and only the
 *   section a question is about (`about`); questions that share a state go in one request;
 * - a Noul read at 0.7 / 0.3, the band between as half; a Score by its position or its top
 *   level, as locked in the questions file (`read`) after looking at the distributions.
 *
 * Eval only: nothing in the app calls this.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loc } from "../app/lib/i18n/localized";
import type { Tool } from "../app/lib/registry/types";
import { JEV_MODEL } from "./eval-evidence-jev-helpers";
import type { EvalCase } from "./eval-helpers";
import { holds, isKnownErrorCase, When } from "./eval-judge-jev-helpers";
import { splitUnits } from "./eval-judge-jev-v3";

export const DIMENSIONS = ["taskFidelity", "pedagogicalSoundness", "formatAdherence", "levelFit", "languageQuality"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** TypeSafe's starting point for a Noul. */
const T = { yes: 0.7, no: 0.3 } as const;
/** "About N words at most" allows this much over N. */
const ABOUT = 1.1;

const round4 = (p: number) => Math.round(p * 1e4) / 1e4;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ── The questions file ─────────────────────────────────────────────────────

const Lang = z.object({ nl: z.string().min(1), en: z.string().min(1) }).strict();
const LangList = z.object({ nl: z.array(z.string().min(1)), en: z.array(z.string().min(1)) }).strict();

const CodeCheck = z.union([
  /** The headings (any level), in this order: the share that stands in order. */
  z.object({ headings: LangList }).strict(),
  /** Fixed strings (a table header, a label): the share the output contains. */
  z.object({ contains: LangList }).strict(),
  /** The exact closing sentence among the last lines. */
  z.object({ closing: Lang }).strict(),
  z.object({ maxWords: z.number().int().positive() }).strict(),
  /** A regular expression (multiline) the output must match, read without bold or italics. */
  z.object({ matches: Lang }).strict(),
  /** The first table has exactly this many rows below its header. */
  z.object({ tableRows: z.number().int().positive() }).strict(),
  /** The first table: the share of rows whose cell in `column` (from 1) matches `pattern`. */
  z
    .object({ cells: z.object({ column: z.number().int().positive(), pattern: Lang }).strict() })
    .strict(),
  /** The number of numbered items is within the range. */
  z
    .object({ numbered: z.object({ min: z.number().int().min(0), max: z.number().int().positive() }).strict() })
    .strict(),
  z.object({ notCutOff: z.literal(true) }).strict(),
  /** The model's turns of a conversation: the share that keeps to every rule given. */
  z
    .object({
      turns: z
        .object({
          maxWords: z.number().int().positive().optional(),
          noLayout: z.literal(true).optional(),
          oneQuestion: z.literal(true).optional(),
          /** Leave out the last turn: the feedback after a role-play. */
          exceptLast: z.literal(true).optional(),
        })
        .strict(),
    })
    .strict(),
]);
type CodeCheck = z.infer<typeof CodeCheck>;

const NEEDS = ["inputs", "description", "known_error", "eqf", "output_language", "user_turns"] as const;
type Need = (typeof NEEDS)[number];

/**
 * What part of the output a question reads: the whole, one section by its heading, everything from
 * a heading to the end (feedback after a conversation), or a stage.
 */
const About = z.union([
  z.object({ heading: Lang }).strict(),
  z.object({ from: Lang }).strict(),
  z.object({ stage: z.string().min(1) }).strict(),
]);
type About = z.infer<typeof About>;

const Common = {
  id: z.string().regex(/^[A-Za-z][\w-]*$/),
  /** The rubric sentence the part comes from (a test checks it is in the rubric). */
  source: z.string().min(1),
  when: When.optional(),
  /** The part is left out when this holds (a case where the rubric asks for something else). */
  unless: When.optional(),
  /** Only for outputs in this language (Dutch anglicisms). */
  lang: z.enum(["nl", "en"]).optional(),
  /** Parts of one group are averaged first and count as one part (six phases of one sentence). */
  group: z.string().min(1).optional(),
  /** When this part fails (value 0), the dimension is at most this. */
  capAt: z.number().int().min(1).max(4).optional(),
};

const Asked = {
  about: About.optional(),
  needs: z.array(z.enum(NEEDS)),
  ask: z.string().min(1),
};

const Part = z.discriminatedUnion("type", [
  z.object({ ...Common, ...Asked, type: z.literal("score"), levels: z.array(z.string().min(1)).min(2).max(10) }).strict(),
  z
    .object({
      ...Common,
      ...Asked,
      type: z.literal("noul"),
      yes: z.string().min(1),
      no: z.string().min(1),
      /** Which answer is the good one. */
      good: z.enum(["yes", "no"]),
    })
    .strict(),
  z.object({ ...Common, type: z.literal("code"), about: About.optional(), check: CodeCheck }).strict(),
]);
export type V4Part = z.infer<typeof Part>;

const ToolDims = z.object(Object.fromEntries(DIMENSIONS.map((d) => [d, z.array(Part).min(1)])) as Record<Dimension, z.ZodArray<typeof Part>>).strict();

const DimensionsV4Schema = z
  .object({
    version: z.literal(4),
    about: z.string(),
    /** How code reads a Score: its position (the expectation) or its most likely level. */
    read: z.enum(["position", "top"]),
    holdout: z.array(z.string()),
    tools: z.record(z.string(), ToolDims),
  })
  .strict();
export type DimensionsV4 = z.infer<typeof DimensionsV4Schema>;

export function loadDimensionsV4(): DimensionsV4 {
  return DimensionsV4Schema.parse(
    JSON.parse(readFileSync(join(__dirname, "../evals/judge-jev/dimensions.v4.json"), "utf8")),
  );
}

// ── What code checks ───────────────────────────────────────────────────────

/** Words: tokens with a letter or digit, so markup (`##`, `-`, `|`) does not count. */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const norm = (s: string) => s.replace(/[*_`]/g, "").replace(/\s+/g, " ").trim();

/** The headings of a document at any level, as written (a numbered heading keeps its number). */
const headingsOf = (text: string) => headingLines(text).map((h) => h.text);

/** How many of `want` appear in `found` in the same order (the longest common subsequence). */
function inOrder(want: string[], found: string[]): number {
  let prev: number[] = Array(found.length + 1).fill(0);
  for (const w of want) {
    const row: number[] = [0];
    for (let j = 0; j < found.length; j++)
      row.push(found[j] === w ? (prev[j] as number) + 1 : Math.max(prev[j + 1] as number, row[j] as number));
    prev = row;
  }
  return prev[found.length] as number;
}

/** The rows below the header of the first markdown table, as trimmed cells. */
function firstTableRows(text: string): string[][] {
  const lines = text.split("\n").map((l) => l.trim());
  const start = lines.findIndex((l, i) => l.startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? ""));
  if (start < 0) return [];
  const rows: string[][] = [];
  for (const l of lines.slice(start + 2)) {
    if (!l.startsWith("|")) break;
    rows.push(l.replace(/^\||\|$/g, "").split("|").map((c) => norm(c)));
  }
  return rows;
}

const LAYOUT = /^\s*(#{1,6}\s|[-*+•]\s|\d+[.)]\s)|\*\*[^*]+\*\*/m;

/** The value (0 to 1) of a part that code decides. */
export function codeValue(check: CodeCheck, output: string, lang: string): number {
  const l = lang === "en" ? "en" : "nl";
  if ("headings" in check) {
    const want = check.headings[l].map(norm);
    return want.length ? inOrder(want, headingsOf(output)) / want.length : 1;
  }
  if ("contains" in check) {
    const want = check.contains[l].map(norm);
    const text = norm(output);
    return want.length ? want.filter((w) => text.includes(w)).length / want.length : 1;
  }
  if ("matches" in check) return new RegExp(check.matches[l], "m").test(output.replace(/[*_`]/g, "")) ? 1 : 0;
  if ("tableRows" in check) return firstTableRows(output).length === check.tableRows ? 1 : 0;
  if ("cells" in check) {
    const rows = firstTableRows(output);
    const re = new RegExp(check.cells.pattern[l]);
    return rows.length ? rows.filter((r) => re.test(r[check.cells.column - 1] ?? "")).length / rows.length : 0;
  }
  if ("numbered" in check) {
    const n = (output.match(/^\s*\d+[.)]\s/gm) ?? []).length;
    return n >= check.numbered.min && n <= check.numbered.max ? 1 : 0;
  }
  if ("closing" in check) {
    const tail = norm(output.trim().split("\n").slice(-4).join(" "));
    return tail.includes(norm(check.closing[l])) ? 1 : 0;
  }
  if ("maxWords" in check) return words(output) <= check.maxWords * ABOUT ? 1 : 0;
  if ("notCutOff" in check) {
    const last = output.trim().split("\n").at(-1)?.trim() ?? "";
    return /[.!?)"'”’*`|:]$/.test(last) ? 1 : 0;
  }
  const r = check.turns;
  const all = splitUnits(output, "turn").map((u) => u.text);
  const turns = r.exceptLast ? all.slice(0, -1) : all;
  if (!turns.length) return 1;
  const ok = turns.filter(
    (t) =>
      (!r.maxWords || words(t) <= r.maxWords * ABOUT) &&
      (!r.noLayout || !LAYOUT.test(t)) &&
      (!r.oneQuestion || (t.match(/\?/g) ?? []).length === 1),
  ).length;
  return ok / turns.length;
}

// ── The requests ───────────────────────────────────────────────────────────

/** A tool of the registry. */
type JudgedTool = Pick<Tool, "slug" | "name" | "tagline">;

export interface OutputInput {
  tool: JudgedTool;
  c: EvalCase;
  output: string;
}

function caseField(c: EvalCase, need: Need): unknown {
  switch (need) {
    case "inputs":
      return c.values ?? {};
    case "description":
      return c.description ?? "";
    case "known_error":
      return isKnownErrorCase(c) ? (c.description ?? "") : null;
    case "eqf":
      return c.profile?.eqf ?? null;
    case "output_language":
      return c.outputLanguage;
    case "user_turns":
      return c.userTurns ?? [];
  }
}

/** Every heading line: its level, its text, where it starts, and whether it opens a stage. */
const headingLines = (output: string) =>
  [...output.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map((m) => ({
    level: (m[1] as string).length,
    text: norm(m[2] as string),
    index: m.index,
    stage: /^### Stage: /.test(m[0]),
  }));

/** The text a part reads, or undefined when the output has no such section or stage. */
function textFor(about: About | undefined, output: string, lang: string): string | undefined {
  if (!about) return output;
  const l = lang === "en" ? "en" : "nl";
  if ("from" in about) {
    const want = norm(about.from[l]);
    const at = headingLines(output).find((h) => h.text === want);
    return at && output.slice(at.index).trim();
  }
  if ("stage" in about) {
    const units = splitUnits(output, "whole", about.stage);
    return units.length ? units.map((u) => u.text).join("\n\n") : undefined;
  }
  const want = norm(about.heading[l]);
  const all = headingLines(output);
  const i = all.findIndex((h) => h.text === want);
  const at = all[i];
  if (!at) return undefined;
  const end = all.slice(i + 1).find((h) => h.level <= at.level || h.stage);
  return output.slice(at.index, end?.index).trim();
}

type Question =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } };

export interface V4Request {
  /** The questions of this request, as `<dimension>.<part id>`. */
  parts: string[];
  request: { model: string; state: unknown; questions: Record<string, Question> };
}

/** Whether a part is asked for this case. */
const applies = (p: V4Part, c: EvalCase) =>
  holds(p.when, c) && !(p.unless && holds(p.unless, c)) && (!p.lang || p.lang === (c.outputLanguage === "en" ? "en" : "nl"));

const asked = (d: DimensionsV4, slug: string) =>
  DIMENSIONS.flatMap((dim) => (d.tools[slug]?.[dim] ?? []).map((p) => [`${dim}.${p.id}`, p] as const));

/** The requests for one output: questions that share a state (the same section, the same fields) together. */
export function planRequestsV4(input: OutputInput, d: DimensionsV4, opts: { model?: string } = {}): V4Request[] {
  const { tool, c, output } = input;
  const groups = new Map<string, V4Request>();
  for (const [qid, p] of asked(d, tool.slug)) {
    if (p.type === "code" || !applies(p, c)) continue;
    const text = textFor(p.about, output, c.outputLanguage);
    if (text === undefined) continue;
    const needs = [...p.needs].sort();
    const key = JSON.stringify([p.about ?? null, needs]);
    let g = groups.get(key);
    if (!g) {
      g = {
        parts: [],
        request: {
          model: opts.model ?? JEV_MODEL,
          state: {
            tool: { name: loc(tool.name, "en"), does: loc(tool.tagline, "en") },
            case: Object.fromEntries(needs.map((n) => [n, caseField(c, n)])),
            output: text,
          },
          questions: {},
        },
      };
      groups.set(key, g);
    }
    g.parts.push(qid);
    g.request.questions[qid] =
      p.type === "score"
        ? { type: "score", instructions: p.ask, criteria: p.levels }
        : { type: "noul", instructions: p.ask, criteria: { true: p.yes, false: p.no } };
  }
  return [...groups.values()];
}

// ── The answers ────────────────────────────────────────────────────────────

const isProbability = (p: unknown): p is number => typeof p === "number" && p >= 0 && p <= 1;

/** The questions of a request, as far as `keepScoreAnswers` reads them. */
export type AskedV4 = Record<string, { type: "score"; criteria: unknown[] } | { type: "noul" }>;

/**
 * What the raw file keeps of Jev's answer: only the asked questions; for a Score its position and
 * the probability of each of its own levels, for a Noul its probability, rounded to four decimals.
 */
export function keepScoreAnswers(body: unknown, questions: AskedV4): Record<string, unknown> {
  const answers = (body as { answers?: Record<string, Record<string, unknown>> } | null)?.answers;
  const kept: Record<string, unknown> = {};
  if (!answers || typeof answers !== "object") return kept;
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id];
    if (q.type === "noul") {
      if (isProbability(a?.noul)) kept[id] = { noul: round4(a.noul) };
      continue;
    }
    const probs = (a?.probabilities ?? {}) as Record<string, unknown>;
    const probabilities: Record<string, number> = {};
    for (let i = 0; i < q.criteria.length; i++) {
      const p = probs[String(i)];
      if (isProbability(p)) probabilities[String(i)] = round4(p);
    }
    const score = a?.score;
    if (typeof score === "number" && Number.isFinite(score) && Object.keys(probabilities).length)
      kept[id] = { score: round4(score), probabilities };
  }
  return kept;
}

/** One part's value on 0 to 1, or undefined when it has no usable answer. */
function partValue(p: V4Part, qid: string, input: OutputInput, answers: Record<string, unknown>, read: DimensionsV4["read"]) {
  if (p.type === "code") {
    const text = textFor(p.about, input.output, input.c.outputLanguage);
    return text === undefined ? 0 : codeValue(p.check, text, input.c.outputLanguage);
  }
  const a = answers[qid] as { noul?: number; score?: number; probabilities?: Record<string, number> } | undefined;
  if (p.type === "noul") {
    if (!isProbability(a?.noul)) return undefined;
    const yes = a.noul >= T.yes ? 1 : a.noul <= T.no ? 0 : 0.5;
    return p.good === "yes" ? yes : 1 - yes;
  }
  const top = p.levels.length - 1;
  if (read === "position") return typeof a?.score === "number" ? Math.min(Math.max(a.score / top, 0), 1) : undefined;
  const probs = Object.entries(a?.probabilities ?? {});
  if (!probs.length) return undefined;
  const [level] = probs.reduce((best, e) => (e[1] > best[1] ? e : best));
  return Number(level) / top;
}

export interface DimensionDecision {
  /** The score as the judge gives it: a whole number 1 to 5. */
  score: number;
  /** Before rounding, after a cap. */
  x: number;
  /** Each answered part's value, 0 to 1 (a group's parts each as answered). */
  parts: Record<string, number>;
  capped?: boolean;
}

/** Each dimension of one output, from the stored answers, without the API. */
export function decideDimensions(
  input: OutputInput,
  d: DimensionsV4,
  answers: Record<string, unknown>,
): Partial<Record<Dimension, DimensionDecision>> {
  const out: Partial<Record<Dimension, DimensionDecision>> = {};
  for (const dim of DIMENSIONS) {
    const parts: Record<string, number> = {};
    const units = new Map<string, number[]>();
    let cap = 5;
    for (const p of d.tools[input.tool.slug]?.[dim] ?? []) {
      if (!applies(p, input.c)) continue;
      const v = partValue(p, `${dim}.${p.id}`, input, answers, d.read);
      if (v === undefined) continue;
      parts[p.id] = v;
      const unit = p.group ? `group:${p.group}` : `part:${p.id}`;
      units.set(unit, [...(units.get(unit) ?? []), v]);
      if (p.capAt !== undefined && v === 0) cap = Math.min(cap, p.capAt);
    }
    const values = [...units.values()].map(mean);
    if (!values.length) continue;
    const raw = 1 + 4 * mean(values);
    const x = Math.min(raw, cap);
    out[dim] = { score: Math.floor(x + 0.5), x, parts, ...(x < raw ? { capped: true } : {}) };
  }
  return out;
}
