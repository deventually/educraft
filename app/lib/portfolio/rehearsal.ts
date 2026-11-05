/**
 * The rehearsal assessment (brief P29, 29.2), the pure half: what the played
 * committee gets to see of the dossier, and how its feedback is checked before
 * a teacher ever sees it. No server, no provider, no UI (that is 29.3).
 *
 * Anti-fabrication lives here, in code, not only in the prompt:
 * - only the chosen outcomes' criteria, under short keys; unknown or repeated
 *   keys and unknown `heard` values are dropped;
 * - a quote must be in the teacher's own turns (verbatim, modulo whitespace and
 *   quote style); otherwise it is dropped and "convincing" becomes "partial";
 * - a tip or summary that cites an author + year the reference list lacks is
 *   dropped;
 * - there is no field for a grade, a score or a pass: anything like it is stripped.
 *
 * Privacy: evidence goes to the model as titles only, never its text.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import type { Locale } from "~/lib/i18n";
import { COACH_INPUT_LIMITS, citesUnknownSource, quoteInChapter } from "./coach";
import { wordCount } from "./progress";
import type { DossierData } from "./types";

export const REHEARSAL_PROMPT_ID = "portfolio-rehearsal@v1";

/** What the app sends first: the committee answers with its opening and first question. */
export const REHEARSAL_START: Record<Locale, string> = {
  nl: "Ik ben er klaar voor.",
  en: "I am ready.",
};

/** What the teacher types (or the app sends) to end the interview and get feedback. */
export const REHEARSAL_CLOSE: Record<Locale, string> = { nl: "Rond af", en: "Wrap up" };

export const REHEARSAL_LENGTHS = ["short", "full"] as const;
export type RehearsalLength = (typeof REHEARSAL_LENGTHS)[number];

export const HEARD = ["convincing", "partial", "not-heard"] as const;
export type Heard = (typeof HEARD)[number];

/** Output limits for the feedback. */
export const REHEARSAL_LIMITS = { quote: 1_000, tip: 600, overall: 1_200 } as const;

export interface RehearsalOptions {
  length: RehearsalLength;
  locale: Locale;
  /** The outcomes to talk about; absent or empty = all. */
  outcomeIds?: string[];
}

export interface RehearsalCriterionFeedback {
  criterionId: string;
  heard: Heard;
  /** A sentence the teacher really typed (checked in code). */
  quote?: string;
  /** True when the model gave a quote the teacher never typed: dropped, "convincing" lowered. */
  quoteUnverified?: true;
  tip?: string;
}

export interface RehearsalFeedback {
  criteria: RehearsalCriterionFeedback[];
  overall: string;
}

const LABELS = {
  nl: {
    evidence: (n: number) => (n === 1 ? "1 bewijsstuk" : `${n} bewijsstukken`),
    status: { "not-started": "nog niet begonnen", "in-progress": "bezig", shown: "aangetoond" },
    startWith: "Begin bij",
    none: "(geen)",
    empty: "(Nog geen tekst.)",
    truncated: "[… ingekort]",
    linkedTo: "hoort bij",
    length: {
      short: "Kort: ongeveer 6 vragen, ongeveer 15 minuten.",
      full: "Volledig: ongeveer 12 vragen, zoals een eindgesprek van 30 minuten.",
    },
  },
  en: {
    evidence: (n: number) => (n === 1 ? "1 evidence item" : `${n} evidence items`),
    status: { "not-started": "not started", "in-progress": "in progress", shown: "shown" },
    startWith: "Start with",
    none: "(none)",
    empty: "(No text yet.)",
    truncated: "[… shortened]",
    linkedTo: "belongs to",
    length: {
      short: "Short: about 6 questions, about 15 minutes.",
      full: "Full: about 12 questions, like a 30-minute final interview.",
    },
  },
} as const;

/** A chapter shorter than this counts as thin. */
const THIN_CHAPTER_WORDS = 150;

function clip(text: string, max: number, marker: string): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n${marker}`;
}

/**
 * The placeholder values for the rehearsal prompt (all but `contextProfile`),
 * built on the server from the dossier only, plus the key → criterion map the
 * feedback is checked against.
 */
export function buildRehearsalContext(
  d: DossierData,
  opts: RehearsalOptions,
): { values: Record<string, string>; keys: Record<string, string> } {
  const l = LABELS[opts.locale];
  const chosen = opts.outcomeIds?.length ? new Set(opts.outcomeIds) : null;
  const outcomes = d.framework.outcomes.filter((o) => !chosen || chosen.has(o.id));
  const chapterOf = new Map(d.chapters.map((ch) => [ch.outcomeId, ch.text.trim()]));

  const keys: Record<string, string> = {};
  const keyOf = new Map<string, string>();
  const rows = outcomes.flatMap((o) =>
    o.criteria.map((c) => {
      const key = `K${keyOf.size + 1}`;
      keys[key] = c.id;
      keyOf.set(c.id, key);
      const evidence = d.evidence.filter((e) => e.criterionIds.includes(c.id)).length;
      const status = d.status[c.id] ?? "not-started";
      const words = wordCount(chapterOf.get(o.id) ?? "");
      // Higher = thinner: no evidence, not shown, an empty or short chapter.
      const thin =
        (evidence === 0 ? 2 : 0) +
        (status === "shown" ? 0 : 1) +
        (words === 0 ? 2 : words < THIN_CHAPTER_WORDS ? 1 : 0);
      return { o, c, key, evidence, status, thin };
    }),
  );

  const framework = [
    ...outcomes.map((o) =>
      [
        `## ${[o.code, o.title].filter(Boolean).join(" ")}`,
        ...rows
          .filter((r) => r.o.id === o.id)
          .map((r) => `- ${r.key}: ${r.c.text} (${l.evidence(r.evidence)}; ${l.status[r.status]})`),
      ].join("\n"),
    ),
    rows.length
      ? `${l.startWith}: ${[...rows]
          .sort((a, b) => b.thin - a.thin)
          .map((r) => r.key)
          .join(", ")}`
      : l.none,
  ].join("\n\n");

  const perChapter = Math.floor(COACH_INPUT_LIMITS.chapter / Math.max(1, outcomes.length));
  const chapters = outcomes
    .map((o) => {
      const text = chapterOf.get(o.id) ?? "";
      return `## ${[o.code, o.title].filter(Boolean).join(" ")}\n${text ? clip(text, perChapter, l.truncated) : l.empty}`;
    })
    .join("\n\n");

  const evidence = d.evidence
    .map((e) => ({ e, linked: e.criterionIds.flatMap((id) => keyOf.get(id) ?? []) }))
    .filter(({ linked }) => linked.length > 0)
    .map(({ e, linked }, i) => `- B${i + 1}: ${e.title} (${l.linkedTo} ${linked.join(", ")})`);

  return {
    keys,
    values: {
      framework: outcomes.length ? framework : l.none,
      chapters: chapters || l.none,
      evidenceTitles: evidence.length ? evidence.join("\n") : l.none,
      references: d.references.length ? d.references.map((r) => `- ${r.apa}`).join("\n") : l.none,
      formNotes: d.framework.requirements.notes?.trim() || l.none,
      length: l.length[opts.length],
    },
  };
}

// ── Checking the feedback ───────────────────────────────────────────────────

const RawCriterion = z.object({
  key: z.string(),
  heard: z.string(),
  quote: z.string().nullish(),
  tip: z.string().nullish(),
});
const RawFeedback = z.object({
  criteria: z.array(z.unknown()),
  overall: z.string().nullish(),
});

export type RehearsalParseResult =
  | { ok: true; feedback: RehearsalFeedback }
  | { ok: false; error: "unparseable" };

const isHeard = (v: string): v is Heard => (HEARD as readonly string[]).includes(v);

const trimTo = (s: string | null | undefined, max: number) => {
  const t = s?.trim();
  return t ? t.slice(0, max) : undefined;
};

/**
 * Checks and maps the model's closing answer. Never throws. `teacherTurns` are
 * the teacher's own messages in this conversation, the only place a quote may
 * come from.
 */
export function parseRehearsalFeedback(
  raw: string,
  keys: Record<string, string>,
  d: DossierData,
  teacherTurns: string[],
): RehearsalParseResult {
  const parsed = RawFeedback.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const said = teacherTurns.join("\n");
  const references = d.references.map((r) => r.apa);
  const clean = (s: string | null | undefined, max: number) => {
    const t = trimTo(s, max);
    return t && !citesUnknownSource(t, references) ? t : undefined;
  };

  const seen = new Set<string>();
  const criteria: RehearsalCriterionFeedback[] = [];
  for (const item of parsed.data.criteria) {
    const c = RawCriterion.safeParse(item);
    if (!c.success || !Object.hasOwn(keys, c.data.key) || seen.has(c.data.key)) continue;
    if (!isHeard(c.data.heard)) continue;
    seen.add(c.data.key);
    const quote = trimTo(c.data.quote, REHEARSAL_LIMITS.quote);
    const verified = quote ? quoteInChapter(quote, said) : false;
    const out: RehearsalCriterionFeedback = {
      criterionId: keys[c.data.key],
      heard: quote && !verified && c.data.heard === "convincing" ? "partial" : c.data.heard,
    };
    if (quote && verified) out.quote = quote;
    if (quote && !verified) out.quoteUnverified = true;
    const tip = clean(c.data.tip, REHEARSAL_LIMITS.tip);
    if (tip) out.tip = tip;
    criteria.push(out);
  }
  return {
    ok: true,
    feedback: { criteria, overall: clean(parsed.data.overall, REHEARSAL_LIMITS.overall) ?? "" },
  };
}
