/**
 * Version 3 of Jev as judge of the hard checks (README "Versie 3"). Version 2 asked Jev about a
 * whole output at once; on long text that gave false alarms, and Jev could not point to its
 * evidence. Version 3 follows TypeSafe's own recipes and guidance, without a twist of ours:
 * - a known error: the recipe semantic_find (`findRequests`, `decideFind`): the output as
 *   numbered lines, a Choice over the lines and an exists Noul, at 0.7 / 0.35;
 * - a claim against its source: the recipe citation_check: a Choice supports / contradicts /
 *   says_nothing whose top relation counts from 0.8, per piece, screened by a topic Noul;
 * - every other check: code cuts the output into pieces (`splitUnits`), and per piece Jev
 *   classifies with a Choice of named kinds written from the rubric, plus a companion Noul on
 *   whether the piece is on topic at all (better than a "none of these" option, as of Jev 1.14);
 * - only the state fields a question names (`needs`); code decides at 0.7 / 0.3 (`decidePiece`,
 *   `decideCheck`), and the piece that fails is the evidence;
 * - a check about the whole output stays with the LLM judge: it is not a small question.
 *
 * Eval only. Versions 1 and 2 stay in `eval-judge-jev-helpers.ts`, for rescoring.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { loc } from "../app/lib/i18n/localized";
import type { Tool } from "../app/lib/registry/types";
import { JEV_MODEL } from "./eval-evidence-jev-helpers";
import type { EvalCase } from "./eval-helpers";
import { holds, isKnownErrorCase, type JevVerdict, outputByStage, When } from "./eval-judge-jev-helpers";

/** TypeSafe's starting point for a Noul. */
const T = { yes: 0.7, no: 0.3 } as const;
/** semantic_find: answered in the document from 0.7, not in it under 0.35. */
const FIND = { found: 0.7, absent: 0.35 } as const;
/** citation_check: a relation is taken without review from 0.8. */
const CITE = { accept: 0.8 } as const;
/** A Choice takes at most 255 options. */
const MAX_OPTIONS = 255;

const UNIT_KINDS = ["block", "section", "turn", "first-turn", "exchange", "whole"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/** One piece of an output. `user` is what the user said just before a model turn. */
export interface Unit {
  id: string;
  where: string;
  text: string;
  user?: string;
}

const round4 = (p: number) => Math.round(p * 1e4) / 1e4;

// ── Cutting ─────────────────────────────────────────────────────────────────

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const LIST_ITEM = /^\s*(?:[-*+•]|\d+[.)])\s/;
const TABLE_ROW = /^\s*\|/;
const TABLE_RULE = /^\s*\|?\s*:?-{3,}/;
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Walks a document's lines, keeping the heading path above each line. */
function* withPath(text: string): Generator<{ line: string; path: string[]; heading: boolean }> {
  const stack: { level: number; title: string }[] = [];
  for (const line of text.split("\n")) {
    const h = HEADING.exec(line);
    if (h) {
      const level = (h[1] as string).length;
      while (stack.length && (stack.at(-1) as { level: number }).level >= level) stack.pop();
      stack.push({ level, title: h[2] as string });
    }
    yield { line, path: stack.map((s) => s.title), heading: !!h };
  }
}

const joinPath = (prefix: string[], path: string[]) => [...prefix, ...path].join(" › ");

function blocks(text: string, prefix: string[]): Omit<Unit, "id">[] {
  const out: Omit<Unit, "id">[] = [];
  let current: string[] = [];
  let where = "";
  let table: { header: string[]; rows: boolean } | null = null;
  const flush = () => {
    const t = current.join("\n").trim();
    if (t) out.push({ where, text: t });
    current = [];
  };
  for (const { line, path, heading } of withPath(text)) {
    const at = joinPath(prefix, path);
    if (heading || !line.trim() || RULE.test(line)) {
      flush();
      if (!TABLE_ROW.test(line)) table = null;
      where = at;
      continue;
    }
    if (TABLE_ROW.test(line)) {
      flush();
      where = at;
      if (!table) table = { header: [line], rows: false };
      else if (!table.rows && TABLE_RULE.test(line)) {
        table.header.push(line);
        table.rows = true;
      } else out.push({ where, text: [...(table.rows ? table.header : []), line].join("\n") });
      continue;
    }
    table = null;
    if (LIST_ITEM.test(line)) flush();
    if (!current.length) where = at;
    current.push(line);
  }
  flush();
  return out;
}

function sections(text: string, prefix: string[]): Omit<Unit, "id">[] {
  const out: Omit<Unit, "id">[] = [];
  let current: string[] = [];
  let where = joinPath(prefix, []);
  let heading = false;
  const flush = () => {
    const lines = current.filter((l) => !RULE.test(l));
    const body = (heading ? lines.slice(1) : lines).join("\n").trim();
    if (body) out.push({ where, text: lines.join("\n").trim() });
    current = [];
  };
  for (const line of withPath(text)) {
    if (line.heading) {
      flush();
      where = joinPath(prefix, line.path);
      heading = true;
    }
    current.push(line.line);
  }
  flush();
  return out;
}

const SPEAKER = /^\*\*(Tutor|Committee|Student|Teacher)( \(greeting\))?:\*\*\s*/;
const MODEL = new Set(["Tutor", "Committee"]);

/** The model's turns, without the app's fixed greeting, each with the user's turn before it. */
function turns(text: string): Omit<Unit, "id">[] {
  const out: Omit<Unit, "id">[] = [];
  let user: string | undefined;
  for (const block of text.split(/\n\n(?=\*\*(?:Tutor|Committee|Student|Teacher)[^*]*:\*\*)/)) {
    const m = SPEAKER.exec(block);
    if (!m) continue;
    const said = block.slice(m[0].length).trim();
    if (!MODEL.has(m[1] as string)) {
      user = said;
      continue;
    }
    if (m[2]) continue; // the greeting is app text
    out.push({ where: `turn ${out.length + 1}`, text: said, ...(user !== undefined ? { user } : {}) });
    user = undefined;
  }
  return out;
}

const LETTER: Record<UnitKind, string> = {
  block: "B",
  section: "S",
  turn: "T",
  "first-turn": "T",
  exchange: "E",
  whole: "W",
};

function cut(text: string, kind: UnitKind, prefix: string[]): Omit<Unit, "id">[] {
  switch (kind) {
    case "block":
      return blocks(text, prefix);
    case "section":
      return sections(text, prefix);
    case "whole":
      return text.trim() ? [{ where: joinPath(prefix, []), text: text.trim() }] : [];
    case "turn":
      return turns(text).map(({ user: _, ...u }) => u);
    case "first-turn":
      return turns(text)
        .slice(0, 1)
        .map(({ user: _, ...u }) => u);
    case "exchange":
      return turns(text);
  }
}

/** The pieces of one kind, per stage for an output in stages (or only the stage named). */
export function splitUnits(output: string, kind: UnitKind, stage?: string): Unit[] {
  const byStage = outputByStage(output);
  const parts: [string | null, string][] =
    typeof byStage === "string"
      ? [[null, byStage]]
      : Object.entries(byStage).filter(([s]) => !stage || s === stage);
  return parts.flatMap(([s, text]) =>
    cut(text, kind, s ? [s] : []).map((u, i) => {
      const n = String(i + 1).padStart(2, "0");
      const id = kind === "whole" ? LETTER.whole : `${LETTER[kind]}${n}`;
      return { ...u, id: s ? `${s}:${id}` : id };
    }),
  );
}

// ── The questions ───────────────────────────────────────────────────────────

const Option = z
  .object({
    says: z.string().min(1),
    /** The failure, or another (allowed) kind. */
    means: z.enum(["fails", "other"]),
    /** The rubric sentence an allowed kind comes from. */
    source: z.string().min(1).optional(),
  })
  .strict();
type Means = z.infer<typeof Option>["means"];

const Asked = z
  .object({
    ask: z.string().min(1),
    yes: z.string().min(1),
    no: z.string().min(1),
    /** Look-alikes the rubric allows, added to the "no" side, each with its rubric sentence. */
    besides: z
      .array(z.object({ says: z.string().min(1), source: z.string().min(1) }).strict())
      .optional(),
  })
  .strict();

const PieceCheckSchema = z
  .object({
    /** For the report: which sort of check this is. */
    family: z.enum(["act", "invented", "part", "conversation"]),
    /** citation_check: the kinds are the recipe's three relations, the top one counts from 0.8. */
    recipe: z.literal("citation_check").optional(),
    unit: z.enum(UNIT_KINDS),
    /** Only this stage of an output in stages. */
    stage: z.string().optional(),
    when: When.optional(),
    /** The case fields the questions name, beside the piece. */
    needs: z.array(z.enum(["inputs", "known_error", "description", "user_turns"])),
    /** The companion Noul: is the piece about the check's subject at all? */
    topic: Asked,
    /** The Choice: which kind of piece this is. */
    kinds: z.object({ ask: z.string().min(1), options: z.record(z.string(), Option) }).strict(),
  })
  .strict();
export type PieceCheck = z.infer<typeof PieceCheckSchema>;

/** A known error, found with TypeSafe's recipe semantic_find. */
const FindCheckSchema = z
  .object({
    family: z.literal("known"),
    recipe: z.literal("semantic_find"),
    when: When,
    /** The plain-language query; `{{known_error}}` is the case's known error. */
    find: z.object({ query: z.string().min(1) }).strict(),
  })
  .strict();
export type FindCheck = z.infer<typeof FindCheckSchema>;

const ChecksV3 = z.object({
  version: z.literal(3),
  about: z.string(),
  holdout: z.array(z.string()),
  /** Tools never measured with Jev before: the clean test. */
  freshHoldout: z.array(z.string()),
  checks: z.record(
    z.string(),
    z.union([
      /** Math, counting, a lookup, or the whole output: the LLM judge, with the reason. */
      z.object({ llm: z.string().min(1) }).strict(),
      FindCheckSchema,
      PieceCheckSchema,
    ]),
  ),
});

type ChecksV3 = z.infer<typeof ChecksV3>;

export function loadChecksV3(): ChecksV3 {
  return ChecksV3.parse(
    JSON.parse(readFileSync(join(__dirname, "../evals/judge-jev/checks.v3.json"), "utf8")),
  );
}

/** The case as version 3 can show it: each field only to a question that needs it. */
export interface CaseView {
  description: string;
  output_language: string;
  inputs: Record<string, unknown>;
  known_error: string | null;
  /** In a chat, what the (scripted) user typed, turn by turn. */
  user_turns: string[];
}

const ABOUT_PIECE =
  "`piece` is one piece of what a tool produced for a case: `piece.text` is the piece, and `piece.where` says where it stands (the headings above it, or which turn of a conversation). In a conversation, `piece.said_before` is what the user said just before. Judge `piece.text` only; the rest is context.";

type Question =
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  /** A null description: the option is read by its name alone (semantic_find's line ids). */
  | { type: "choice"; instructions: string; criteria: Record<string, string | null> };

export interface PieceRequest {
  model: string;
  state: {
    tool: { name: string; does: string };
    piece: { where: string; text: string; said_before?: string };
    case?: Partial<Pick<CaseView, "description" | "inputs" | "known_error" | "user_turns">>;
    about: string;
  };
  questions: Record<string, Question>;
}

/** The kinds in a fixed order: the allowed ones first, the failure last. */
function orderedKinds(check: PieceCheck, reversed: boolean): [string, string][] {
  const all = Object.entries(check.kinds.options);
  const last = (m: Means) => m === "fails";
  const ordered = [...all.filter(([, o]) => !last(o.means)), ...all.filter(([, o]) => last(o.means))];
  return (reversed ? ordered.reverse() : ordered).map(([name, o]) => [name, o.says]);
}

/**
 * The requests for one piece: the checks that need the same state go together, and each
 * request holds only the case fields its questions name.
 */
export function buildPieceRequests(
  tool: { name: string; does: string },
  unit: Unit,
  checks: [string, PieceCheck][],
  view: CaseView,
  opts: { reversed?: boolean; model?: string } = {},
): { checks: string[]; request: PieceRequest }[] {
  const groups = new Map<string, [string, PieceCheck][]>();
  for (const entry of checks) {
    const key = [...new Set(entry[1].needs)].sort().join(",");
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const needs = key ? key.split(",") : [];
    const questions: Record<string, Question> = {};
    for (const [id, check] of group) {
      questions[`${id}.topic`] = {
        type: "noul",
        instructions: check.topic.ask,
        criteria: {
          true: check.topic.yes,
          false: [check.topic.no, ...(check.topic.besides ?? []).map((b) => b.says)].join(" "),
        },
      };
      questions[`${id}.kind`] = {
        type: "choice",
        instructions: check.kinds.ask,
        criteria: Object.fromEntries(orderedKinds(check, !!opts.reversed)),
      };
    }
    const caseFields = Object.fromEntries(
      needs.map((n) => [n, view[n as keyof CaseView]]),
    ) as PieceRequest["state"]["case"];
    return {
      checks: group.map(([id]) => id),
      request: {
        model: opts.model ?? JEV_MODEL,
        state: {
          tool,
          piece: {
            where: unit.where,
            ...(unit.user !== undefined ? { said_before: unit.user } : {}),
            text: unit.text,
          },
          ...(needs.length ? { case: caseFields } : {}),
          about: ABOUT_PIECE,
        },
        questions,
      },
    };
  });
}

// ── The decision ────────────────────────────────────────────────────────────

export interface PieceDecision {
  /** fails: the failure is in this piece; clear: it is not. */
  state: "fails" | "clear" | "unsettled";
  /** The summed probability of the failing kinds. */
  p?: number;
}

const topEntry = (probs: Record<string, number>) =>
  Object.entries(probs).sort((x, y) => y[1] - x[1])[0] as [string, number] | undefined;

/**
 * The truth table per piece, at TypeSafe's 0.7 / 0.3:
 *
 * | topic Noul | failing kinds | → |
 * | --- | --- | --- |
 * | ≥ 0.7 | ≥ 0.7 | fails |
 * | ≤ 0.3 | any | clear |
 * | any | ≤ 0.3 | clear |
 * | otherwise, or an answer missing | | unsettled |
 *
 * A citation_check piece takes the top relation as the verdict, from 0.8 only: supports clears
 * it, contradicts or says_nothing fails it when the piece is on topic (≥ 0.7). Off topic (≤ 0.3)
 * is clear; anything else goes to the judge, as the recipe sends it to a person.
 */
export function decidePiece(check: PieceCheck, id: string, answers: unknown): PieceDecision {
  const a = (answers ?? {}) as Record<string, { noul?: number; probabilities?: Record<string, number> }>;
  const topic = a[`${id}.topic`]?.noul;
  const probs = a[`${id}.kind`]?.probabilities;
  if (topic === undefined || !probs) return { state: "unsettled" };
  const p = round4(
    Object.entries(check.kinds.options)
      .filter(([, o]) => o.means === "fails")
      .reduce((sum, [name]) => sum + (probs[name] ?? 0), 0),
  );
  if (check.recipe === "citation_check") {
    const top = topEntry(probs);
    if (topic <= T.no) return { state: "clear", p };
    if (!top || top[1] < CITE.accept) return { state: "unsettled", p };
    if (check.kinds.options[top[0]]?.means === "other") return { state: "clear", p };
    return { state: topic >= T.yes ? "fails" : "unsettled", p };
  }
  if (topic >= T.yes && p >= T.yes) return { state: "fails", p };
  if (topic <= T.no || p <= T.no) return { state: "clear", p };
  return { state: "unsettled", p };
}

export interface CheckDecision {
  verdict: "fail" | "pass" | "unsettled";
  /** The probability that the check fails, as far as the pieces show it. */
  p?: number;
  /** The piece that shows the failure (or, for a known error, the line that names it). */
  evidence?: Unit;
  pieces: number;
  failed: number;
}

const evidenceOf = (u: Unit): Unit => ({
  id: u.id,
  where: u.where,
  text: u.text,
  ...(u.user !== undefined ? { user: u.user } : {}),
});

/**
 * Per check: one failing piece fails it, and it passes when every piece is clear. No pieces, or
 * a piece unsettled without a failing one: unsettled, for the LLM judge.
 */
export function decideCheck(
  _check: PieceCheck,
  pieces: { unit: Unit; decision: PieceDecision }[],
): CheckDecision {
  const hits = pieces.filter((x) => x.decision.state === "fails");
  const best = hits.reduce<(typeof hits)[number] | undefined>(
    (b, x) => (!b || (x.decision.p ?? 0) > (b.decision.p ?? 0) ? x : b),
    undefined,
  );
  const ps = pieces.map((x) => x.decision.p).filter((p): p is number => p !== undefined);
  const allClear = pieces.length > 0 && pieces.every((x) => x.decision.state === "clear");
  const base = { pieces: pieces.length, failed: hits.length };
  const maxP = ps.length ? { p: Math.max(...ps) } : {};
  if (best) return { verdict: "fail", p: best.decision.p, evidence: evidenceOf(best.unit), ...base };
  if (allClear) return { verdict: "pass", ...maxP, ...base };
  return { verdict: "unsettled", ...maxP, ...base };
}

// ── A known error: semantic_find ────────────────────────────────────────────

/** The output as one document: the stages in order, a conversation without the app's greeting. */
function documentOf(output: string): string {
  const byStage = outputByStage(output);
  const text =
    typeof byStage === "string"
      ? byStage
      : Object.entries(byStage)
          .map(([stage, t]) => `# ${stage}\n\n${t}`)
          .join("\n\n");
  return text
    .split(/\n\n(?=\*\*(?:Tutor|Committee|Student|Teacher)[^*]*:\*\*)/)
    .filter((block) => !SPEAKER.exec(block)?.[2])
    .join("\n\n");
}

/** Python's `splitlines()`, as the recipe splits the document. */
const linesOf = (output: string) => documentOf(output).replace(/\n$/, "").split("\n");
const lineId = (i: number) => `L${String(i).padStart(3, "0")}`;

/** The windows of at most 255 lines, named by their first and last line. */
function windowsOf(n: number): { name: string; from: number; to: number }[] {
  const out: { name: string; from: number; to: number }[] = [];
  for (let from = 0; from < n; from += MAX_OPTIONS) {
    const to = Math.min(n, from + MAX_OPTIONS) - 1;
    out.push({ name: `${lineId(from)}-${lineId(to)}`, from, to });
  }
  return out;
}

const queryOf = (check: FindCheck, view: CaseView) =>
  check.find.query.replace("{{known_error}}", view.known_error ?? "");

export interface FindRequest {
  model: string;
  /** The recipe sends the document as a plain string. */
  state: string;
  questions: Record<string, Question>;
}

const lineChoice = (query: string, ids: string[]): Question => ({
  type: "choice",
  instructions: `Which line of the document contains the answer to: "${query}"?`,
  criteria: Object.fromEntries(ids.map((id) => [id, null])),
});

/**
 * The recipe semantic_find for the known-error checks of one output: one request with the
 * numbered lines, a Choice "where" over the lines and a Noul "exists". Over 255 lines (the most
 * a Choice takes), the recipe's two passes: the first request asks "exists" and picks a window;
 * one more request per window ranks the lines in it, and the decision reads the one picked.
 */
export function findRequests(
  output: string,
  checks: [string, FindCheck][],
  view: CaseView,
  opts: { model?: string } = {},
): { unit: string; checks: string[]; request: FindRequest }[] {
  const lines = linesOf(output);
  const state = lines.map((line, i) => `${lineId(i)}| ${line}`).join("\n");
  const ids = lines.map((_, i) => lineId(i));
  const model = opts.model ?? JEV_MODEL;
  const names = checks.map(([id]) => id);
  const exists = (query: string): Question => ({
    type: "noul",
    instructions: `Does any line of the document address or answer: "${query}"?`,
    criteria: {
      true: "At least one line of the document states or directly implies the answer",
      false: "No line of the document addresses this",
    },
  });
  if (lines.length <= MAX_OPTIONS) {
    const questions: Record<string, Question> = {};
    for (const [id, check] of checks) {
      const query = queryOf(check, view);
      questions[`${id}.where`] = lineChoice(query, ids);
      questions[`${id}.exists`] = exists(query);
    }
    return [{ unit: "F", checks: names, request: { model, state, questions } }];
  }
  const windows = windowsOf(lines.length);
  const first: Record<string, Question> = {};
  for (const [id, check] of checks) {
    const query = queryOf(check, view);
    first[`${id}.window`] = {
      type: "choice",
      instructions: `Which part of the document contains the answer to: "${query}"?`,
      criteria: Object.fromEntries(windows.map((w) => [w.name, `lines ${w.name}`])),
    };
    first[`${id}.exists`] = exists(query);
  }
  return [
    { unit: "F", checks: names, request: { model, state, questions: first } },
    ...windows.map((w, i) => ({
      unit: `F:W${i}`,
      checks: names,
      request: {
        model,
        state,
        questions: Object.fromEntries(
          checks.map(([id, check]) => [`${id}.where`, lineChoice(queryOf(check, view), ids.slice(w.from, w.to + 1))]),
        ),
      },
    })),
  ];
}

/**
 * semantic_find's decision: "exists" from 0.7 means the output names the known error (the check
 * passes, with the top line as the evidence); under 0.35 it does not (the check fails); in
 * between, the judge decides.
 */
export function decideFind(
  _check: FindCheck,
  id: string,
  output: string,
  answers: Record<string, unknown>,
): CheckDecision {
  type A = Record<string, { noul?: number; probabilities?: Record<string, number> }>;
  const lines = linesOf(output);
  const first = answers.F as A | undefined;
  const exists = first?.[`${id}.exists`]?.noul;
  const base = { pieces: lines.length, failed: 0 };
  if (exists === undefined) return { verdict: "unsettled", ...base };
  const p = round4(1 - exists);
  if (exists < FIND.absent) return { verdict: "fail", p, ...base };
  if (exists < FIND.found) return { verdict: "unsettled", p, ...base };
  const windows = lines.length > MAX_OPTIONS ? windowsOf(lines.length) : undefined;
  const window = windows
    ? windows.findIndex((w) => w.name === topEntry(first?.[`${id}.window`]?.probabilities ?? {})?.[0])
    : -1;
  const where = (windows ? (answers[`F:W${window}`] as A | undefined) : first)?.[`${id}.where`]?.probabilities;
  const top = topEntry(where ?? {})?.[0];
  const n = top ? Number(top.slice(1)) : Number.NaN;
  const evidence = Number.isInteger(n) && lines[n] !== undefined ? { id: top as string, where: `line ${n}`, text: lines[n] as string } : undefined;
  return { verdict: "pass", p, ...(evidence ? { evidence } : {}), ...base };
}

// ── One output ──────────────────────────────────────────────────────────────

/** A tool of the registry, or one judged by its own runner (portfolio-rehearsal). */
type JudgedTool = Tool | { slug: string; name: string; does: string };

const toolInfo = (t: JudgedTool) =>
  typeof t.name === "string"
    ? { name: t.name, does: (t as { does: string }).does }
    : { name: loc(t.name, "en"), does: loc((t as Tool).tagline, "en") };

/** The case as version 3 shows it to a question that needs it. */
function viewOf(c: EvalCase): CaseView {
  return {
    description: c.description ?? "",
    output_language: c.outputLanguage,
    inputs: c.values ?? {},
    known_error: isKnownErrorCase(c) ? (c.description ?? "") : null,
    user_turns: c.userTurns ?? [],
  };
}

interface OutputInput {
  tool: JudgedTool;
  c: EvalCase;
  output: string;
  /** Default: `viewOf(c)`. */
  view?: CaseView;
}

const ofTool = (specs: ChecksV3, slug: string) =>
  Object.entries(specs.checks)
    .filter(([k]) => k.startsWith(`${slug}/`))
    .map(([k, v]) => [k.slice(slug.length + 1), v] as const);

/** What to ask about one output: requests per piece, and what code or the judge decides. */
export function planOutputV3(
  input: OutputInput,
  specs: ChecksV3,
  opts: { reversed?: boolean; model?: string } = {},
) {
  const { tool, c, output } = input;
  const view = input.view ?? viewOf(c);
  const byCode: string[] = [];
  const llm: string[] = [];
  const perUnit = new Map<string, { unit: Unit; checks: [string, PieceCheck][] }>();
  const finds: [string, FindCheck][] = [];
  for (const [id, spec] of ofTool(specs, tool.slug)) {
    if ("llm" in spec) llm.push(id);
    else if (!holds(spec.when, c)) byCode.push(id);
    else if ("find" in spec) finds.push([id, spec]);
    else
      for (const unit of splitUnits(output, spec.unit, spec.stage)) {
        const at = perUnit.get(unit.id) ?? { unit, checks: [] };
        at.checks.push([id, spec]);
        perUnit.set(unit.id, at);
      }
  }
  const calls: { unit: string; checks: string[]; request: PieceRequest | FindRequest }[] = [
    ...[...perUnit.values()].flatMap(({ unit, checks }) =>
      buildPieceRequests(toolInfo(tool), unit, checks, view, opts).map((r) => ({ unit: unit.id, ...r })),
    ),
    // semantic_find has no options to reverse: it is asked once
    ...(finds.length && !opts.reversed ? findRequests(output, finds, view, opts) : []),
  ];
  return { calls, byCode, llm };
}

export type V3Verdict = Omit<CheckDecision, "verdict" | "pieces" | "failed"> &
  Partial<Pick<CheckDecision, "pieces" | "failed">> & {
    verdict: JevVerdict;
    /** code: the check does not hold for this case. */
    by?: "code";
  };

/** The questions of a request, as far as `keepAnswers` reads them. */
export type AskedQuestions = Record<string, { type: "noul" | "choice"; criteria?: Record<string, unknown> }>;

const isProbability = (p: unknown): p is number => typeof p === "number" && p >= 0 && p <= 1;

/**
 * What the raw file keeps of Jev's answer: only the questions that were asked and, for a Choice,
 * only its own options, each a probability rounded to four decimals. Everything else in the
 * response (other keys, text, usage) is dropped, so the file holds nothing the API made up.
 */
export function keepAnswers(body: unknown, questions: AskedQuestions): Record<string, unknown> {
  const answers = (body as { answers?: Record<string, { noul?: unknown; probabilities?: Record<string, unknown> }> } | null)
    ?.answers;
  const kept: Record<string, unknown> = {};
  if (!answers || typeof answers !== "object") return kept;
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id];
    if (q.type === "noul") {
      if (isProbability(a?.noul)) kept[id] = { noul: round4(a.noul) };
      continue;
    }
    const probabilities: Record<string, number> = {};
    for (const option of Object.keys(q.criteria ?? {})) {
      const p = a?.probabilities?.[option];
      if (isProbability(p)) probabilities[option] = round4(p);
    }
    if (Object.keys(probabilities).length) kept[id] = { probabilities };
  }
  return kept;
}

/** Every check of the output, decided from the stored answers (per piece id) without the API. */
export function decideOutputV3(
  input: OutputInput,
  specs: ChecksV3,
  stored: { answers: Record<string, unknown> },
): Record<string, V3Verdict> {
  const { tool, c, output } = input;
  const out: Record<string, V3Verdict> = {};
  for (const [id, spec] of ofTool(specs, tool.slug)) {
    if ("llm" in spec) out[id] = { verdict: "llm" };
    else if (!holds(spec.when, c)) out[id] = { verdict: "pass", by: "code" };
    else if ("find" in spec) out[id] = decideFind(spec, id, output, stored.answers);
    else {
      const pieces = splitUnits(output, spec.unit, spec.stage).map((unit) => ({
        unit,
        decision: decidePiece(spec, id, stored.answers[unit.id]),
      }));
      out[id] = decideCheck(spec, pieces);
    }
  }
  return out;
}

const topOf = (a: unknown): string | undefined => {
  const probs = (a as { probabilities?: Record<string, number> } | undefined)?.probabilities;
  return probs ? topEntry(probs)?.[0] : undefined;
};

/**
 * The plan's test 5: a Choice can lean to the option it reads first, so every piece is asked a
 * second time with the kinds reversed. Counted on the pieces Jev puts on topic (Noul ≥ 0.7).
 */
export function orderAgreement(
  input: OutputInput,
  specs: ChecksV3,
  stored: { answers: Record<string, unknown>; reversed: Record<string, unknown> },
): { same: number; total: number } {
  let same = 0;
  let total = 0;
  for (const [id, spec] of ofTool(specs, input.tool.slug)) {
    if (!("kinds" in spec) || !holds(spec.when, input.c)) continue;
    for (const unit of splitUnits(input.output, spec.unit, spec.stage)) {
      const a = stored.answers[unit.id] as Record<string, { noul?: number }> | undefined;
      const r = stored.reversed[unit.id] as Record<string, unknown> | undefined;
      if ((a?.[`${id}.topic`]?.noul ?? 0) < T.yes || !r) continue;
      const top = topOf(a?.[`${id}.kind`]);
      const topReversed = topOf(r[`${id}.kind`]);
      if (!top || !topReversed) continue;
      total++;
      if (top === topReversed) same++;
    }
  }
  return { same, total };
}
