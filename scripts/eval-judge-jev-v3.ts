/**
 * Version 3 of Jev as judge of the hard checks (plan: Claude Doc "Jev versie 3: meetplan",
 * README "Versie 3"). Version 2 asked Jev about a whole output at once; on long text that gave
 * false alarms, and Jev could not point to its evidence. Version 3 follows TypeSafe's own
 * patterns instead of asking more of one question:
 * - code cuts the output into pieces (`splitUnits`): blocks, sections, turns or exchanges;
 * - per piece Jev classifies with a Choice of named kinds, written from the rubric, the allowed
 *   look-alikes first, plus a companion Noul on whether the piece is on topic at all (better
 *   than a "none of these" option, as of Jev 1.14);
 * - only the state fields a question names (`needs`), so one request per piece and state;
 * - code decides per piece and per check (`decidePiece`, `decideCheck`) at 0.7 / 0.3, and the
 *   piece that fails is the evidence.
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
import {
  buildJudgeJevRequest,
  holds,
  isKnownErrorCase,
  type JevVerdict,
  loadJudgeSpecs,
  outputByStage,
  parseJudgeJevAnswer,
  When,
} from "./eval-judge-jev-helpers";

const T = { yes: 0.7, no: 0.3 } as const;

const UNIT_KINDS = ["block", "section", "turn", "first-turn", "exchange", "whole"] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

/** One piece of an output. `user` is what the user said just before a model turn. */
export interface Unit {
  id: string;
  where: string;
  text: string;
  user?: string;
}

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
    /** The failure, the known error found, or another (allowed) kind. */
    means: z.enum(["fails", "found", "other"]),
    /** The rubric sentence an allowed kind comes from. */
    source: z.string().min(1).optional(),
  })
  .strict();
type Means = z.infer<typeof Option>["means"];

const Asked = z.object({ ask: z.string().min(1), yes: z.string().min(1), no: z.string().min(1) }).strict();

const PieceCheckSchema = z
  .object({
    /** For the report: which sort of check this is. */
    family: z.enum(["act", "invented", "known", "part", "conversation"]),
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

const ChecksV3 = z.object({
  version: z.literal(3),
  about: z.string(),
  holdout: z.array(z.string()),
  /** Tools never measured with Jev before: the clean test. */
  freshHoldout: z.array(z.string()),
  checks: z.record(
    z.string(),
    z.union([
      z.object({ llm: z.string().min(1) }).strict(),
      /** About the whole output: asked as in version 2. */
      z.object({ keep: z.literal("v2"), why: z.string().min(1) }).strict(),
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
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

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

/** The kinds in a fixed order: the allowed ones first, the failure (or the target) last. */
function orderedKinds(check: PieceCheck, reversed: boolean): [string, string][] {
  const all = Object.entries(check.kinds.options);
  const last = (m: Means) => m !== "other";
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
        criteria: { true: check.topic.yes, false: check.topic.no },
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
  /** fails: the failure is in this piece; found: the known error is named here; clear: neither. */
  state: "fails" | "found" | "clear" | "unsettled";
  /** The summed probability of the failing (or target) kinds. */
  p?: number;
}

const targetOf = (check: PieceCheck): Exclude<Means, "other"> => (check.family === "known" ? "found" : "fails");

/**
 * The truth table per piece, at TypeSafe's 0.7 / 0.3:
 *
 * | topic Noul | failing (or target) kinds | → |
 * | --- | --- | --- |
 * | ≥ 0.7 | ≥ 0.7 | fails (found) |
 * | ≤ 0.3 | any | clear |
 * | any | ≤ 0.3 | clear |
 * | otherwise, or an answer missing | | unsettled |
 */
export function decidePiece(check: PieceCheck, id: string, answers: unknown): PieceDecision {
  const a = (answers ?? {}) as Record<string, { noul?: number; probabilities?: Record<string, number> }>;
  const topic = a[`${id}.topic`]?.noul;
  const probs = a[`${id}.kind`]?.probabilities;
  if (topic === undefined || !probs) return { state: "unsettled" };
  const target = targetOf(check);
  const p = Object.entries(check.kinds.options)
    .filter(([, o]) => o.means === target)
    .reduce((sum, [name]) => sum + (probs[name] ?? 0), 0);
  if (topic >= T.yes && p >= T.yes) return { state: target, p };
  if (topic <= T.no || p <= T.no) return { state: "clear", p };
  return { state: "unsettled", p };
}

export interface CheckDecision {
  verdict: "fail" | "pass" | "unsettled";
  /** The probability that the check fails, as far as the pieces show it. */
  p?: number;
  /** The piece that shows the failure (or names the known error). */
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
 * Per check: one failing piece fails it, and it passes when every piece is clear. A known error
 * turns this around: one piece that names it passes the check, and it fails when no piece does.
 * No pieces, or a piece unsettled without a decisive one: unsettled, for the LLM judge.
 */
export function decideCheck(
  check: PieceCheck,
  pieces: { unit: Unit; decision: PieceDecision }[],
): CheckDecision {
  const target = targetOf(check);
  const hits = pieces.filter((x) => x.decision.state === target);
  const best = hits.reduce<(typeof hits)[number] | undefined>(
    (b, x) => (!b || (x.decision.p ?? 0) > (b.decision.p ?? 0) ? x : b),
    undefined,
  );
  const ps = pieces.map((x) => x.decision.p).filter((p): p is number => p !== undefined);
  const allClear = pieces.length > 0 && pieces.every((x) => x.decision.state === "clear");
  const failed = target === "fails" ? hits.length : 0;
  const base = { pieces: pieces.length, failed };
  if (target === "fails") {
    if (best) return { verdict: "fail", p: best.decision.p, evidence: evidenceOf(best.unit), ...base };
    if (allClear) return { verdict: "pass", ...(ps.length ? { p: Math.max(...ps) } : {}), ...base };
    return { verdict: "unsettled", ...(ps.length ? { p: Math.max(...ps) } : {}), ...base };
  }
  const notFound = ps.length ? 1 - Math.max(...ps) : undefined;
  if (best) return { verdict: "pass", p: 1 - (best.decision.p ?? 0), evidence: evidenceOf(best.unit), ...base };
  if (allClear) return { verdict: "fail", ...(notFound !== undefined ? { p: notFound } : {}), ...base };
  return { verdict: "unsettled", ...(notFound !== undefined ? { p: notFound } : {}), ...base };
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

/** The checks about the whole output, as version 2 asks them. */
function keptSpecs(specs: ChecksV3, slug: string) {
  const v2 = loadJudgeSpecs(2);
  const kept = ofTool(specs, slug).filter(([, v]) => "keep" in v);
  return {
    ...v2,
    checks: Object.fromEntries(kept.flatMap(([id]) => {
      const spec = v2.checks[`${slug}/${id}`];
      return spec ? [[`${slug}/${id}`, spec]] : [];
    })),
  };
}

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
  for (const [id, spec] of ofTool(specs, tool.slug)) {
    if ("llm" in spec) llm.push(id);
    else if ("keep" in spec) continue;
    else if (!holds(spec.when, c)) byCode.push(id);
    else
      for (const unit of splitUnits(output, spec.unit, spec.stage)) {
        const at = perUnit.get(unit.id) ?? { unit, checks: [] };
        at.checks.push([id, spec]);
        perUnit.set(unit.id, at);
      }
  }
  const calls = [...perUnit.values()].flatMap(({ unit, checks }) =>
    buildPieceRequests(toolInfo(tool), unit, checks, view, opts).map((r) => ({ unit: unit.id, ...r })),
  );
  const kept =
    "tagline" in tool && ofTool(specs, tool.slug).some(([, v]) => "keep" in v)
      ? buildJudgeJevRequest({ tool, c, output }, keptSpecs(specs, tool.slug), opts)
      : undefined;
  return { calls, byCode, llm, ...(kept ? { kept } : {}) };
}

export type V3Verdict = Omit<CheckDecision, "verdict" | "pieces" | "failed"> &
  Partial<Pick<CheckDecision, "pieces" | "failed">> & {
    verdict: JevVerdict;
    /** code: the check does not hold for this case; v2: asked as in version 2. */
    by?: "code" | "v2";
  };

/** Every check of the output, decided from the stored answers (per piece id) without the API. */
export function decideOutputV3(
  input: OutputInput,
  specs: ChecksV3,
  stored: { answers: Record<string, unknown>; kept?: unknown },
): Record<string, V3Verdict> {
  const { tool, c, output } = input;
  const out: Record<string, V3Verdict> = {};
  const keptVerdicts =
    "tagline" in tool && stored.kept !== undefined
      ? parseJudgeJevAnswer(stored.kept, tool, c, keptSpecs(specs, tool.slug)).verdicts
      : {};
  for (const [id, spec] of ofTool(specs, tool.slug)) {
    if ("llm" in spec) out[id] = { verdict: "llm" };
    else if ("keep" in spec) {
      const v = keptVerdicts[id];
      out[id] = { verdict: v?.verdict ?? "unsettled", ...(v?.p !== undefined ? { p: v.p } : {}), by: "v2" };
    } else if (!holds(spec.when, c)) out[id] = { verdict: "pass", by: "code" };
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
  if (!probs) return undefined;
  return Object.entries(probs).sort((x, y) => y[1] - x[1])[0]?.[0];
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
    if (!("family" in spec) || !holds(spec.when, input.c)) continue;
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
