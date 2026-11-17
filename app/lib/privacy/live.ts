/**
 * The live preview (anonymiseerpoort PR 3, BESLUIT-2026-11-17-6): while the teacher types, the
 * browser runs the same engine as the server gate and shows what goes to the AI. Pure.
 *
 * Two layers. What only the teacher knows (the student, the company, extra words) is replaced
 * here and never reaches the server; the code table stays in the page. The names the app knows
 * and the patterns are shown here but replaced by the gate, which gets the teacher's approval
 * with the request, so what LimeOnIt keeps has the real names again. In student work
 * (`redact: true`) everything is replaced here, so the original never leaves the browser.
 */
import { knownEntries, type KnownPeople } from "./gate";
import { redactOptions } from "./pack";
import {
  applyRedactions,
  type CodeTable,
  findRedactions,
  type RedactEntry,
  type RedactSpan,
} from "./redact";

/** What the teacher names in the preview; page memory only (BESLUIT-2026-11-04-20). */
export interface NamedPeople {
  student: string;
  studentNumber: string;
  company: string;
  companyDescription: string;
  /** One per line. */
  supervisors: string;
  /** "Ook vervangen": one per line. */
  extra: string;
}

export const emptyNamed: NamedPeople = {
  student: "",
  studentNumber: "",
  company: "",
  companyDescription: "",
  supervisors: "",
  extra: "",
};

/** What a tool page gives the live preview: the names the gate knows, the never-list. */
export interface PrivacyPage {
  known: KnownPeople;
  never: string[];
  /** The words the institution keeps (PR 5): never replaced, not the teacher's to take off. */
  shared?: string[];
}

export interface LiveChoices {
  named: NamedPeople;
  /** Words not replaced: clicked off in the preview, or on the teacher's never-list. */
  keep: readonly string[];
  /** The words the institution keeps (PR 5): like the pack's, never marked at all. */
  shared?: readonly string[];
  /** Words the gate found and the teacher then approved. */
  approved?: readonly string[];
}

/** Where a replacement happens: the teacher's names here, the rest at the gate. */
export type LiveKind = "named" | "known" | "pattern";

export interface LiveSpan extends RedactSpan {
  kind: LiveKind;
  /** On the keep list: shown, not replaced. */
  kept: boolean;
}

export interface LiveField {
  name: string;
  text: string;
  /** Student work: everything is replaced in the browser. */
  redact?: boolean;
}

/** What the request carries for the gate (`PrivacyApprovalSchema`). */
export interface PrivacyApproval {
  approved: string[];
  keep: string[];
  studentNumberExample?: string;
}

/** The gate's caps (`PrivacyApprovalSchema`). */
const MAX_WORDS = 500;
const MAX_WORD = 200;
/** Parts are matched as one text, so a value gets one code everywhere; no match crosses this. */
const SEPARATOR = "\n\u0000\n";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const lines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const NAMED_CODES = /^(STUDENT|STUDENTNUMMER|BEDRIJF|BEGELEIDER|ANDER)(-\d+)?$/;
const KNOWN_CODES = /^(DOCENT|COLLEGA)(-\d+)?$/;

function kindOf(span: RedactSpan): LiveKind {
  if (span.source === "extra" || NAMED_CODES.test(span.code)) return "named";
  return KNOWN_CODES.test(span.code) ? "known" : "pattern";
}

function namedEntries(n: NamedPeople): RedactEntry[] {
  return [
    { kind: "student" as const, value: n.student },
    { kind: "studentNumber" as const, value: n.studentNumber },
    { kind: "company" as const, value: n.company, description: n.companyDescription },
    ...lines(n.supervisors).map((value) => ({ kind: "supervisor" as const, value })),
  ].filter((e) => e.value.trim());
}

/**
 * A word that may go on the never-list: letters, spaces, hyphens and apostrophes, 2 to 100
 * characters. Anything with a digit or an `@` is a person's data and stays in the page.
 */
export function isKeepWord(word: string): boolean {
  const w = word.trim();
  return w.length >= 2 && w.length <= 100 && /^\p{L}[\p{L}\p{M}' ’.-]*$/u.test(w);
}

/**
 * The student number's shape ("s1234567" → "s0000000"): enough for the gate to learn the format,
 * never the number itself.
 */
export function studentNumberShape(example: string): string | undefined {
  const shape = example.trim().replace(/\d/g, "0");
  return shape ? shape.slice(0, 30) : undefined;
}

/** Every text's spans, with one code per value across all of them. */
function spansAcross(texts: readonly string[], known: KnownPeople, c: LiveChoices): LiveSpan[][] {
  const joined = texts.join(SEPARATOR);
  const keep = new Set(c.keep.map(norm));
  const options = redactOptions({ studentNumberExample: c.named.studentNumber });
  const spans = findRedactions(
    joined,
    [...knownEntries(known), ...namedEntries(c.named)],
    lines(c.named.extra),
    { ...options, keep: [...(options.keep ?? []), ...(c.shared ?? [])] },
  );
  const out: LiveSpan[][] = [];
  let at = 0;
  for (const text of texts) {
    const end = at + text.length;
    out.push(
      spans
        .filter((s) => s.start >= at && s.end <= end)
        .map((s) => ({
          ...s,
          start: s.start - at,
          end: s.end - at,
          kind: kindOf(s),
          kept: keep.has(norm(s.original)) || keep.has(norm(s.value)),
        })),
    );
    at = end + SEPARATOR.length;
  }
  return out;
}

/** The fields with every replacement marked, for "Dit gaat naar de AI". */
export function livePreview<F extends LiveField>(
  fields: readonly F[],
  known: KnownPeople,
  choices: LiveChoices,
): Array<F & { spans: LiveSpan[] }> {
  const spans = spansAcross(
    fields.map((f) => f.text),
    known,
    choices,
  );
  return fields.map((f, i) => ({ ...f, spans: spans[i] ?? [] }));
}

function capped(words: Iterable<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const word = w.trim().slice(0, MAX_WORD);
    if (!word || seen.has(norm(word))) continue;
    seen.add(norm(word));
    out.push(word);
  }
  return out.slice(0, MAX_WORDS);
}

/**
 * What leaves the browser: the fields (and `others`: the conversation, earlier steps) with the
 * teacher's names replaced, the code table to put them back, and the approval for the gate: the
 * known names and patterns the preview showed, the kept words and the student number's shape.
 */
export function prepareSend(
  input: { fields: readonly LiveField[]; others?: readonly string[] },
  known: KnownPeople,
  choices: LiveChoices,
): {
  values: Record<string, string>;
  others: string[];
  codes: CodeTable;
  approval: PrivacyApproval;
} {
  const others = input.others ?? [];
  const parts: LiveField[] = [...input.fields, ...others.map((text) => ({ name: "", text }))];
  const spans = spansAcross(
    parts.map((p) => p.text),
    known,
    choices,
  );
  const codes: CodeTable = {};
  const approved: string[] = [];
  const texts = parts.map((part, i) => {
    const own = spans[i] ?? [];
    const here = (s: LiveSpan) => !s.kept && (part.redact || s.kind === "named");
    for (const s of own) if (!s.kept && !here(s)) approved.push(s.value);
    const skip = new Set(own.flatMap((s, j) => (here(s) ? [] : [j])));
    const applied = applyRedactions(part.text, own, skip);
    Object.assign(codes, applied.codes);
    return applied.text;
  });
  const shape = studentNumberShape(choices.named.studentNumber);
  return {
    values: Object.fromEntries(input.fields.map((f, i) => [f.name, texts[i] ?? f.text])),
    others: texts.slice(input.fields.length),
    codes,
    approval: {
      approved: capped([...approved, ...(choices.approved ?? [])]),
      keep: capped(choices.keep),
      ...(shape ? { studentNumberExample: shape } : {}),
    },
  };
}
