/**
 * Quotes from feedback per criterion (BDB/BKE): the answers of a workplace supervisor, a fellow
 * student, an expert, a second assessor or fellow candidates are evidence; the AI proposes, per
 * criterion, sentences from them, and the candidate chooses which go in. The pure half: the
 * message, the code checks on the answer and the edit that stores the choice.
 *
 * Anti-fabrication lives here, in code: a quote is kept only when it stands in the feedback word
 * for word (modulo spacing, case and quote marks), and it is stored in the feedback's own words,
 * never the model's. The giver's name never goes to the AI; the draft cites role and date.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import type { Locale } from "~/lib/i18n";
import { LIMITS, QUOTE_LIMITS } from "./schema";
import {
  type DossierData,
  type EvidenceItem,
  FEEDBACK_ROLES,
  type FeedbackQuote,
  type FeedbackRole,
  type FeedbackSource,
} from "./types";

export const QUOTES_PROMPT_ID = "portfolio-quotes@v1";

/** The giver's role as the AI and the draft see it. */
const ROLE_LABELS: Record<Locale, Record<FeedbackRole, string>> = {
  nl: {
    "workplace-supervisor": "Werkplekbegeleider",
    "fellow-student": "Medecursist",
    expert: "Deskundige",
    "second-assessor": "4-ogencollega",
    "fellow-candidate": "Medekandidaat",
    other: "Anders",
  },
  en: {
    "workplace-supervisor": "Workplace supervisor",
    "fellow-student": "Fellow student",
    expert: "Expert",
    "second-assessor": "Second assessor",
    "fellow-candidate": "Fellow candidate",
    other: "Other",
  },
};

// ── The message ─────────────────────────────────────────────────────────────

/** The feedback cannot close or open the tags around it. */
const data = (s: string) => s.replace(/<(\/?)(feedback|framework|outcome|criterion)/gi, "‹$1$2");

/** The user message: every outcome's criteria, keyed (U1.C1), then the feedback. */
export function buildQuotesMessage(
  d: DossierData,
  item: Pick<EvidenceItem, "text">,
  role: FeedbackRole,
  locale: Locale,
): string {
  const outcomes = d.framework.outcomes.map((o, i) => {
    const key = `U${i + 1}`;
    return [
      `<outcome key="${key}">${data([o.code, o.title].filter(Boolean).join(" "))}`,
      ...o.criteria.map((c, j) => `<criterion key="${key}.C${j + 1}">${data(c.text)}</criterion>`),
      "</outcome>",
    ].join("\n");
  });
  const text = data(item.text.trim().slice(0, QUOTE_LIMITS.excerpt));
  return [
    `<framework>\n${outcomes.join("\n")}\n</framework>`,
    `<feedback role="${ROLE_LABELS[locale][role]}">\n${text}\n</feedback>`,
  ].join("\n\n");
}

// ── Verbatim ────────────────────────────────────────────────────────────────

const QUOTE_MARKS = /["'“”„«»‘’‚]/;
/** Shorter than this is a fragment, not a quote. */
const MIN_WORDS = 3;

/** The text normalised per character, with each character's index in the original. */
function normalised(s: string): { text: string; at: number[] } {
  let text = "";
  const at: number[] = [];
  let space = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? "";
    if (/\s/.test(ch)) {
      space = text.length > 0;
      continue;
    }
    if (space) {
      text += " ";
      at.push(i);
      space = false;
    }
    const c = QUOTE_MARKS.test(ch) ? '"' : /[–—]/.test(ch) ? "-" : ch.toLowerCase();
    text += c.slice(0, 1);
    at.push(i);
  }
  return { text, at };
}

/**
 * The span of `source` that `quote` stands for, in the source's own words; `null` when the quote
 * is not in it word for word (a paraphrase, an elision) or is too short to be a quote.
 */
export function verbatimSpan(quote: string, source: string): string | null {
  const q = normalised(quote.trim()).text.replace(/^"+|"+$/g, "").trim();
  if (q.split(" ").length < MIN_WORDS) return null;
  const hay = normalised(source);
  const from = hay.text.indexOf(q);
  if (from < 0) return null;
  const start = hay.at[from];
  const end = hay.at[from + q.length - 1];
  return start === undefined || end === undefined ? null : source.slice(start, end + 1);
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAnswer = z.object({
  quotes: z.array(z.object({ criterion: z.unknown(), quote: z.unknown() }).partial()),
});

/** Criterion keys (U1.C2) → ids. */
function keyedCriteria(d: DossierData): Map<string, string> {
  return new Map(
    d.framework.outcomes.flatMap((o, i) =>
      o.criteria.map((c, j) => [`U${i + 1}.C${j + 1}`, c.id] as const),
    ),
  );
}

/**
 * The proposal: per known criterion at most a few quotes, each in the feedback's own words.
 * Anything else is dropped and counted. `null` when the answer is no JSON.
 */
export function parseQuotesAnswer(
  raw: string | null,
  d: DossierData,
  source: string,
): { quotes: FeedbackQuote[]; dropped: number } | null {
  const parsed = raw === null ? null : RawAnswer.safeParse(extractJson(raw));
  if (!parsed?.success) return null;
  const keys = keyedCriteria(d);
  const quotes: FeedbackQuote[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const a of parsed.data.quotes) {
    const criterionId = typeof a.criterion === "string" ? keys.get(a.criterion) : undefined;
    const text = typeof a.quote === "string" ? verbatimSpan(a.quote, source) : null;
    const id = `${criterionId}\u0000${normalised(text ?? "").text}`;
    const room = quotes.filter((x) => x.criterionId === criterionId).length;
    if (!criterionId || !text || text.length > QUOTE_LIMITS.quote || seen.has(id)) {
      dropped++;
      continue;
    }
    if (room >= QUOTE_LIMITS.perCriterion) continue;
    seen.add(id);
    quotes.push({ criterionId, text });
  }
  return { quotes, dropped };
}

// ── Storing the choice ──────────────────────────────────────────────────────

const Id = z.string().min(1).max(LIMITS.id);

const QuoteList = z
  .string()
  .max(QUOTE_LIMITS.quotes * (QUOTE_LIMITS.quote + 200))
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "invalid JSON" });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(z.object({ criterionId: Id, text: z.string().min(1).max(QUOTE_LIMITS.quote) }))
      .max(QUOTE_LIMITS.quotes),
  );

/** The form "Bewaar": the item, who gave the feedback, when, and the ticked quotes. */
export const ChooseQuotesSchema = z.object({
  evidenceId: Id,
  giver: z.string().trim().min(1).max(QUOTE_LIMITS.giver),
  role: z.enum(FEEDBACK_ROLES),
  date: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  quotes: QuoteList,
});

/**
 * Stores who gave the feedback and the chosen quotes, each in the feedback's own words, and links
 * the item to their criteria. Throws on an unknown item or criterion, or a quote that is not in
 * the feedback word for word.
 */
export function setFeedbackQuotes(
  d: DossierData,
  evidenceId: string,
  source: FeedbackSource,
): DossierData {
  const item = d.evidence.find((e) => e.id === evidenceId);
  if (!item) throw new RangeError("unknown evidence");
  const known = new Set(d.framework.outcomes.flatMap((o) => o.criteria.map((c) => c.id)));
  const quotes = source.quotes.map((q) => {
    const text = verbatimSpan(q.text, item.text);
    if (!known.has(q.criterionId) || !text) throw new RangeError("not a quote");
    return { criterionId: q.criterionId, text };
  });
  const linked = [...item.criterionIds];
  for (const q of quotes) if (!linked.includes(q.criterionId)) linked.push(q.criterionId);
  const feedback: FeedbackSource = {
    giver: source.giver,
    role: source.role,
    ...(source.date ? { date: source.date } : {}),
    quotes,
  };
  return {
    ...d,
    evidence: d.evidence.map((e) =>
      e.id === evidenceId ? { ...e, criterionIds: linked, feedback } : e,
    ),
  };
}

/** The quotes that still stand: their text in the item's text, their criterion linked to it. */
export function standingQuotes(item: EvidenceItem): FeedbackQuote[] {
  return (item.feedback?.quotes ?? []).filter(
    (q) => item.criterionIds.includes(q.criterionId) && verbatimSpan(q.text, item.text) !== null,
  );
}

/** "werkplekbegeleider, 12 november 2026": how the coach and the draft see who said it. */
export function quoteAttribution(f: FeedbackSource, locale: Locale): string {
  const role = ROLE_LABELS[locale][f.role].toLowerCase();
  if (!f.date) return role;
  const date = new Date(`${f.date}T00:00:00Z`).toLocaleDateString(
    locale === "en" ? "en-GB" : "nl-NL",
    { dateStyle: "long", timeZone: "UTC" },
  );
  return `${role}, ${date}`;
}
