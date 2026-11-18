/**
 * The anonymiseerpoort's pure core (PR 2, BESLUIT-2026-11-17-5). The same engine as the browser
 * (`findRedactions`), run over everything that leaves the server, with the names the app knows:
 * the teacher and the colleagues around them. The server half (`privacyGate.server.ts`) fetches
 * those names, logs the counts and makes the call.
 *
 * Three modes: `count` sends the text unchanged and only counts what it would replace (until the
 * teacher sees a preview, steps 3 and 4); `review` replaces what the teacher saw and sends
 * nothing while anything is left they did not see; `replace` replaces everything (evals).
 * The code table lives only as long as one call; nothing here stores or logs a value.
 */
import type { ChatMessage } from "~/lib/ai/types";
import { CODE_NOTE, redactOptions } from "./pack";
import {
  applyRedactions,
  type CodeTable,
  findRedactions,
  type RedactEntry,
  type RedactSpan,
  restoreNames,
} from "./redact";

export type GateMode = "count" | "review" | "replace";

export interface KnownPeople {
  teacher?: string;
  colleagues: readonly string[];
}

export interface GatePolicy {
  known: KnownPeople;
  mode: GateMode;
  /** `review`: the values the teacher saw replaced in the preview (any case). */
  approved?: readonly string[];
  /** Words the teacher chose not to replace: never replaced, never asked. */
  keep?: readonly string[];
  /** One student number the teacher typed; the format is learnt from it (`studentNumberFormat`). */
  studentNumberExample?: string;
  /**
   * Words the teacher chose to replace in text the server already holds (a course; step 4): they
   * are replaced like a name (`[ANDER-n]`) and need no approval. Never counted per kind.
   */
  replace?: readonly string[];
}

export type GateKind = "teacher" | "colleague" | "email" | "iban" | "phone" | "postcode" | "number";

export type GateCounts = Partial<Record<GateKind, number>>;

/** One word the teacher has not seen yet, with how often it occurs. */
export interface ReviewItem {
  value: string;
  code: string;
  kind: GateKind;
  count: number;
}

export type GateResult =
  | { send: true; texts: string[]; codes: CodeTable; counts: GateCounts }
  | { send: false; review: ReviewItem[]; counts: GateCounts };

const KIND_OF: Record<string, GateKind> = {
  DOCENT: "teacher",
  COLLEGA: "colleague",
  "E-MAIL": "email",
  IBAN: "iban",
  TELEFOON: "phone",
  POSTCODE: "postcode",
  NUMMER: "number",
};

const CODE = /\[([A-Z]+(?:-[A-Z]+)*(?:-\d+)?)\]/g;
/** Parts are matched as one text, so a value gets one code everywhere; no match crosses this. */
const SEPARATOR = "\n\u0000\n";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const baseOf = (code: string) => code.replace(/-\d+$/, "");

/** The names the app knows, as engine entries; the browser preview uses the same ones. */
export function knownEntries(known: KnownPeople): RedactEntry[] {
  const usable = (name: string | undefined): name is string =>
    !!name && name.trim().length >= 2 && !name.includes("@");
  const teacher = usable(known.teacher) ? known.teacher.trim() : undefined;
  const seen = new Set(teacher ? [norm(teacher)] : []);
  const colleagues = known.colleagues.filter(usable).filter((n) => {
    if (seen.has(norm(n))) return false;
    seen.add(norm(n));
    return true;
  });
  return [
    ...(teacher ? [{ kind: "teacher" as const, value: teacher }] : []),
    ...colleagues.map((value) => ({ kind: "colleague" as const, value: value.trim() })),
  ];
}

/** Gives every code that is already in the text (the browser's) a wide berth. */
function renumber(spans: RedactSpan[], text: string): RedactSpan[] {
  const taken = new Set([...text.matchAll(CODE)].map((m) => m[1] ?? ""));
  const renamed = new Map<string, string>();
  const free = (code: string) => {
    if (!taken.has(code)) return code;
    const base = baseOf(code);
    let n = 1;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  };
  return spans.map((s) => {
    if (!renamed.has(s.code)) {
      const code = free(s.code);
      taken.add(code);
      renamed.set(s.code, code);
    }
    return { ...s, code: renamed.get(s.code) ?? s.code };
  });
}

function countsOf(spans: readonly RedactSpan[]): GateCounts {
  const counts: GateCounts = {};
  for (const s of spans) {
    const kind = KIND_OF[baseOf(s.code)];
    if (kind) counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
}

function reviewOf(spans: readonly RedactSpan[]): ReviewItem[] {
  const items = new Map<string, ReviewItem>();
  for (const s of spans) {
    const key = norm(s.value);
    const item = items.get(key);
    if (item) item.count++;
    else
      items.set(key, {
        value: s.value,
        code: s.code,
        kind: KIND_OF[baseOf(s.code)] ?? "number",
        count: 1,
      });
  }
  return [...items.values()];
}

/**
 * A name comes back as it was written when every occurrence was spelt the same ("Fatima"), so a
 * quote stays literal; otherwise as the full name.
 */
function asWritten(codes: CodeTable, spans: readonly RedactSpan[]): CodeTable {
  const out: CodeTable = {};
  for (const [code, value] of Object.entries(codes)) {
    const spellings = new Set(spans.filter((s) => s.code === code).map((s) => s.original));
    out[code] = spellings.size === 1 ? ([...spellings][0] ?? value) : value;
  }
  return out;
}

/** Gates several texts that leave together; every value gets one code across all of them. */
export function gateTexts(texts: readonly string[], policy: GatePolicy): GateResult {
  const joined = texts.join(SEPARATOR);
  const keep = new Set((policy.keep ?? []).map(norm));
  const options = redactOptions({ studentNumberExample: policy.studentNumberExample });
  const replace = policy.replace ?? [];
  const found = findRedactions(joined, knownEntries(policy.known), [...replace], {
    ...options,
    keep: [...(options.keep ?? []), ...(policy.keep ?? [])],
  }).filter((s) => !keep.has(norm(s.value)) && !keep.has(norm(s.original)));
  const spans = renumber(found, joined);
  const counts = countsOf(spans);

  if (policy.mode === "count") return { send: true, texts: [...texts], codes: {}, counts };
  if (policy.mode === "review") {
    const approved = new Set([...(policy.approved ?? []), ...replace].map(norm));
    const unseen = spans.filter((s) => !approved.has(norm(s.value)));
    if (unseen.length > 0) return { send: false, review: reviewOf(unseen), counts };
  }

  const out: string[] = [];
  const codes: CodeTable = {};
  let at = 0;
  for (const text of texts) {
    const end = at + text.length;
    const own = spans
      .filter((s) => s.start >= at && s.end <= end)
      .map((s) => ({ ...s, start: s.start - at, end: s.end - at }));
    const applied = applyRedactions(text, own);
    out.push(applied.text);
    Object.assign(codes, applied.codes);
    at = end + SEPARATOR.length;
  }
  return { send: true, texts: out, codes: asWritten(codes, spans), counts };
}

type PromptResult =
  | { send: true; system: string; messages: ChatMessage[]; codes: CodeTable; counts: GateCounts }
  | { send: false; review: ReviewItem[]; counts: GateCounts };

/** A model call's prompt; the sentence about codes is added only when something was replaced. */
export function gatePrompt(
  prompt: { system: string; messages: readonly ChatMessage[] },
  policy: GatePolicy,
  locale: "nl" | "en",
): PromptResult {
  const r = gateTexts([prompt.system, ...prompt.messages.map((m) => m.content)], policy);
  if (!r.send) return r;
  const [system = "", ...contents] = r.texts;
  const replaced = Object.keys(r.codes).length > 0;
  return {
    send: true,
    system: replaced ? `${system}\n\n${CODE_NOTE[locale]}` : system,
    messages: prompt.messages.map((m, i) => ({ ...m, content: contents[i] ?? m.content })),
    codes: r.codes,
    counts: r.counts,
  };
}

function mapStrings(value: unknown, f: (s: string) => string): unknown {
  if (typeof value === "string") return f(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, f));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, f)]));
  return value;
}

/** Every string in a structured request (Jev's state), keys untouched. */
export function gateJson<T>(
  value: T,
  policy: GatePolicy,
):
  | { send: true; value: T; codes: CodeTable; counts: GateCounts }
  | { send: false; review: ReviewItem[]; counts: GateCounts } {
  const texts: string[] = [];
  mapStrings(value, (s) => {
    texts.push(s);
    return s;
  });
  const r = gateTexts(texts, policy);
  if (!r.send) return r;
  let i = 0;
  const gated = mapStrings(value, (s) => r.texts[i++] ?? s) as T;
  return { send: true, value: gated, codes: r.codes, counts: r.counts };
}

/** Puts the names back in every string of a structured answer. */
export function restoreJson<T>(value: T, codes: CodeTable): T {
  if (Object.keys(codes).length === 0) return value;
  return mapStrings(value, (s) => restoreNames(s, codes)) as T;
}

/** Where a code that is still coming starts ("[COLL"), or -1. */
function openCode(text: string): number {
  const at = text.lastIndexOf("[");
  return at >= 0 && /^\[[A-Z0-9-]{0,40}$/.test(text.slice(at)) ? at : -1;
}

/**
 * Puts the names back into a streamed answer. A code can fall over two chunks, so only an open
 * `[` that may still become a code is held back; the rest goes on at once.
 */
export async function* restoreStream(
  tokens: AsyncIterable<string>,
  codes: CodeTable,
): AsyncIterable<string> {
  if (Object.keys(codes).length === 0) {
    yield* tokens;
    return;
  }
  let held = "";
  for await (const chunk of tokens) {
    held += chunk;
    const open = openCode(held);
    const ready = open < 0 ? held : held.slice(0, open);
    held = open < 0 ? "" : held.slice(open);
    if (ready) yield restoreNames(ready, codes);
  }
  if (held) yield restoreNames(held, codes);
}
