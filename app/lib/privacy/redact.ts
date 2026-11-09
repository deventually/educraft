/**
 * Anonymise before sending (brief P24, 24.0b; BESLUIT-2026-11-04-9).
 *
 * Pure and browser-side. The teacher names what must go (student, student
 * number, company, supervisors, extra words); simple patterns catch e-mail
 * addresses, phone numbers, postcodes, IBANs and number runs that look like a
 * student number. Each is replaced by a code such as `[STUDENT]` or
 * `[E-MAIL-1]`. The code → value table never leaves the browser; it is used to
 * put the names back into the AI's result (`restoreNames`).
 *
 * Honest limits: figures and photos are not anonymised, and a misspelt name or
 * a very recognisable description can slip through. The teacher checks.
 */

export type RedactKind = "student" | "studentNumber" | "company" | "supervisor";

export interface RedactEntry {
  kind: RedactKind;
  value: string;
  /** Companies only: a neutral description placed after the code, e.g. "een webshop in sportartikelen". */
  description?: string;
}

export interface RedactSpan {
  start: number;
  end: number;
  code: string;
  /** The text this span replaces. */
  original: string;
  /** What found it, for the review screen. */
  source: "entry" | "extra" | "pattern";
  /** The canonical value the code stands for (the teacher's spelling of an entry). */
  value: string;
  /** Companies only: shown after the code at its first occurrence. */
  description?: string;
}

/** Code → the value it stands for (the canonical spelling). */
export type CodeTable = Record<string, string>;

const CODE_BASE: Record<RedactKind, string> = {
  student: "STUDENT",
  studentNumber: "STUDENTNUMMER",
  company: "BEDRIJF",
  supervisor: "BEGELEIDER",
};

/** Name particles that are never replaced on their own ("de", "van", …). */
const PARTICLES = new Set([
  "van",
  "de",
  "der",
  "den",
  "het",
  "'t",
  "te",
  "ten",
  "ter",
  "op",
  "in",
  "la",
  "le",
  "du",
  "von",
  "zu",
  "el",
  "al",
  "da",
  "di",
  "dos",
  "bin",
  "ben",
]);

const NOT_WORD_BEFORE = "(?<![\\p{L}\\p{N}])";
const NOT_WORD_AFTER = "(?![\\p{L}\\p{N}])";
const POSSESSIVE = "(?:['’]s|s)?";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whitespace inside a name may be any run of whitespace in the text. */
const flexible = (s: string) => s.trim().split(/\s+/).map(escapeRe).join("\\s+");

/** The spellings of a person's name that are replaced: full, surname with particles, each part. */
function nameVariants(value: string): string[] {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const variants = new Set<string>([parts.join(" ")]);
  const firstParticle = parts.findIndex((p, i) => i > 0 && PARTICLES.has(p.toLowerCase()));
  if (firstParticle > 0) variants.add(parts.slice(firstParticle).join(" "));
  if (parts.length > 1) variants.add(parts.slice(1).join(" "));
  for (const p of parts) {
    if (p.length >= 2 && !PARTICLES.has(p.toLowerCase())) variants.add(p);
  }
  return [...variants].sort((a, b) => b.length - a.length);
}

type Candidate = RedactSpan;

function matchAll(text: string, pattern: string, flags: string): Array<[number, string]> {
  const re = new RegExp(pattern, flags.includes("g") ? flags : `${flags}g`);
  return [...text.matchAll(re)].map((m) => [m.index ?? 0, m[0]]);
}

const PATTERNS: Array<{ base: string; re: string; flags: string }> = [
  { base: "E-MAIL", re: "[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}.-]+\\.[\\p{L}]{2,}", flags: "u" },
  {
    base: "IBAN",
    re: "\\b[A-Z]{2}\\d{2}(?:\\s?[A-Z0-9]{4}){2,7}(?:\\s?[A-Z0-9]{1,3})?\\b",
    flags: "",
  },
  { base: "TELEFOON", re: "(?<![\\d+])(?:\\+31|0031|0)(?:[\\s-]?\\d){9}(?!\\d)", flags: "" },
  { base: "POSTCODE", re: "\\b[1-9]\\d{3}\\s?[A-Z]{2}\\b", flags: "" },
];
/** Lowest priority: a run of 6–8 digits that is not part of a larger number. */
const NUMBER = { base: "NUMMER", re: "(?<![\\d.,])\\b\\d{6,8}\\b(?![.,]\\d)", flags: "" };

/**
 * Every replacement for `text`, in reading order, without overlaps. Strong
 * patterns (e-mail, IBAN, phone, postcode) win over names, so a name inside an
 * e-mail address does not break it; the generic number pattern comes last.
 */
export function findRedactions(
  text: string,
  entries: RedactEntry[],
  extra: string[] = [],
): RedactSpan[] {
  const chosen: Candidate[] = [];
  const overlaps = (c: Candidate) => chosen.some((s) => c.start < s.end && s.start < c.end);
  const take = (cands: Candidate[]) => {
    cands.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    for (const c of cands) if (!overlaps(c)) chosen.push(c);
  };

  // Patterns: the same value always gets the same numbered code.
  const numbered = (base: string, values: Map<string, string>, value: string) => {
    const key = value.replace(/\s+/g, " ").toLowerCase();
    if (!values.has(key)) values.set(key, `${base}-${values.size + 1}`);
    return values.get(key) as string;
  };
  const patternCands = (p: { base: string; re: string; flags: string }) => {
    const values = new Map<string, string>();
    return matchAll(text, p.re, p.flags).map(([start, original]) => ({
      start,
      end: start + original.length,
      code: numbered(p.base, values, original),
      original,
      source: "pattern" as const,
      value: original,
    }));
  };
  take(PATTERNS.flatMap(patternCands));

  // Entries the teacher named, then extra words.
  const perKind = new Map<RedactKind, RedactEntry[]>();
  for (const e of entries) {
    if (!e.value.trim()) continue;
    perKind.set(e.kind, [...(perKind.get(e.kind) ?? []), e]);
  }
  const entryCands: Candidate[] = [];
  for (const [kind, list] of perKind) {
    list.forEach((entry, i) => {
      const code = list.length > 1 ? `${CODE_BASE[kind]}-${i + 1}` : CODE_BASE[kind];
      const isPerson = kind === "student" || kind === "supervisor";
      const variants = isPerson ? nameVariants(entry.value) : [entry.value.trim()];
      for (const v of variants) {
        const re = `${NOT_WORD_BEFORE}(${flexible(v)})${isPerson ? POSSESSIVE : ""}${NOT_WORD_AFTER}`;
        for (const m of text.matchAll(new RegExp(re, "giu"))) {
          const start = m.index ?? 0;
          const original = m[1] ?? "";
          entryCands.push({
            start,
            end: start + original.length,
            code,
            original,
            source: "entry",
            value: entry.value.trim(),
            ...(entry.description?.trim() ? { description: entry.description.trim() } : {}),
          });
        }
      }
    });
  }
  extra
    .map((w) => w.trim())
    .filter(Boolean)
    .forEach((word, i) => {
      const re = `${NOT_WORD_BEFORE}${flexible(word)}${NOT_WORD_AFTER}`;
      for (const [start, original] of matchAll(text, re, "iu")) {
        entryCands.push({
          start,
          end: start + original.length,
          code: `ANDER-${i + 1}`,
          original,
          source: "extra",
          value: word,
        });
      }
    });
  take(entryCands);
  take(patternCands(NUMBER));

  return chosen.sort((a, b) => a.start - b.start);
}

/**
 * Applies the spans, skipping the ones the teacher undid (by index). A company
 * description follows the code at its first occurrence. Returns the text that
 * may be sent and the code table for `restoreNames` (only codes in use).
 */
export function applyRedactions(
  text: string,
  spans: RedactSpan[],
  excluded: ReadonlySet<number> = new Set(),
): { text: string; codes: CodeTable } {
  let out = "";
  let at = 0;
  const codes: CodeTable = {};
  spans.forEach((s, i) => {
    if (excluded.has(i)) return;
    out += text.slice(at, s.start);
    out += `[${s.code}]`;
    if (s.description && !(s.code in codes)) out += ` (${s.description})`;
    codes[s.code] = s.value;
    at = s.end;
  });
  out += text.slice(at);
  return { text: out, codes };
}

/** Puts the names back into a text with codes (the AI's result). Unknown codes stay as they are. */
export function restoreNames(text: string, codes: CodeTable): string {
  return text.replace(/\[([A-Z]+(?:-[A-Z]+)*(?:-\d+)?)\]/g, (m, code: string) => codes[code] ?? m);
}
