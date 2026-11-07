/**
 * Proofreading one chapter, the pure half: what the model gets to see, and how
 * its proposals are checked before a teacher sees them. No server, no provider:
 * `app/server/portfolioCoach.server.ts` does the call.
 *
 * Anti-fabrication lives here, in code:
 * - every proposal names a span that is literally in the chapter (modulo
 *   whitespace, quote style and case); the stored quote is the chapter's own
 *   text, so "Overnemen" replaces exactly that span;
 * - a proposal that changes nothing, repeats a span, or cites an author + year
 *   that neither the span nor the reference list has, is dropped.
 */
import { z } from "zod";
import { extractJson } from "~/lib/ai/structuredAnswer";
import type { Locale } from "~/lib/i18n";
import { COACH_INPUT_LIMITS, citesUnknownSource } from "./coach";
import { PROOFREAD_LIMITS } from "./schema";
import { type DossierData, PROOFREAD_ISSUES, type ProofreadSuggestion } from "./types";

export { PROOFREAD_LIMITS };

const LABELS = {
  nl: {
    outcome: "Leeruitkomst",
    none: "(geen)",
    empty: "(Het hoofdstuk is nog leeg.)",
    truncated: "[… ingekort]",
  },
  en: {
    outcome: "Learning outcome",
    none: "(none)",
    empty: "(The chapter is still empty.)",
    truncated: "[… shortened]",
  },
} as const;

/** The user message for proofreading one outcome's chapter. All teacher material is data. */
export function buildProofreadMessage(d: DossierData, outcomeId: string, locale: Locale): string {
  const o = d.framework.outcomes.find((x) => x.id === outcomeId);
  if (!o) throw new Error(`Unknown outcome: ${outcomeId}`);
  const l = LABELS[locale];
  const raw = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text.trim() ?? "";
  const chapter =
    raw.length > COACH_INPUT_LIMITS.chapter
      ? `${raw.slice(0, COACH_INPUT_LIMITS.chapter)}\n${l.truncated}`
      : raw;
  const references = d.references.length
    ? d.references.map((r) => `- ${r.apa}`).join("\n")
    : l.none;
  return [
    `${l.outcome}: ${[o.code, o.title].filter(Boolean).join(" ")}`,
    `<chapter>\n${chapter || l.empty}\n</chapter>`,
    `<references>\n${references}\n</references>`,
  ].join("\n\n");
}

// ── Locating a span ─────────────────────────────────────────────────────────

const FOLD: Record<string, string> = {
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "‘": "'",
  "’": "'",
  "‚": "'",
  "–": "-",
  "—": "-",
};

/** Normalized text plus, per normalized char, its index in the original. */
function fold(text: string): { text: string; at: number[] } {
  let out = "";
  const at: number[] = [];
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (!space) {
        out += " ";
        at.push(i);
      }
      space = true;
      continue;
    }
    space = false;
    const lower = (FOLD[ch] ?? ch).toLowerCase();
    out += lower.length === 1 ? lower : ch;
    at.push(i);
  }
  return { text: out, at };
}

/**
 * The chapter's own span for `quote`: found modulo whitespace, quote style and
 * case, one contiguous piece (no elisions). `null` when it is not there.
 */
export function locateQuote(quote: string, chapter: string): string | null {
  const needle = fold(quote).text.trim();
  if (!needle) return null;
  const hay = fold(chapter);
  const i = hay.text.indexOf(needle);
  if (i < 0) return null;
  return chapter.slice(hay.at[i], hay.at[i + needle.length - 1] + 1);
}

// ── Checking the answer ─────────────────────────────────────────────────────

const RawAnswer = z.object({ suggestions: z.array(z.unknown()) });
const RawSuggestion = z.object({
  quote: z.string(),
  issue: z.string().nullish(),
  explanation: z.string().nullish(),
  suggestion: z.string(),
});

export type ProofreadParseResult =
  | { ok: true; suggestions: ProofreadSuggestion[]; dropped: number }
  | { ok: false; error: "unparseable" };

const isIssue = (v: unknown): v is ProofreadSuggestion["issue"] =>
  (PROOFREAD_ISSUES as readonly unknown[]).includes(v);

/** Checks and maps a raw model answer. Never throws. */
export function parseProofread(
  raw: string,
  d: DossierData,
  outcomeId: string,
): ProofreadParseResult {
  const parsed = RawAnswer.safeParse(extractJson(raw));
  if (!parsed.success) return { ok: false, error: "unparseable" };
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  const references = d.references.map((r) => r.apa);
  const seen = new Set<string>();
  const suggestions: ProofreadSuggestion[] = [];
  let dropped = 0;
  for (const item of parsed.data.suggestions) {
    const s = RawSuggestion.safeParse(item);
    const quote = s.success ? locateQuote(s.data.quote, chapter) : null;
    const better = s.success ? s.data.suggestion.trim() : "";
    if (
      !s.success ||
      !quote ||
      quote.length > PROOFREAD_LIMITS.quote ||
      !better ||
      fold(better).text === fold(quote).text ||
      seen.has(quote) ||
      citesUnknownSource(better, [...references, quote])
    ) {
      dropped++;
      continue;
    }
    seen.add(quote);
    suggestions.push({
      quote,
      issue: isIssue(s.data.issue) ? s.data.issue : "style",
      explanation: (s.data.explanation ?? "").trim().slice(0, PROOFREAD_LIMITS.explanation),
      suggestion: better.slice(0, PROOFREAD_LIMITS.suggestion),
    });
  }
  return { ok: true, suggestions: suggestions.slice(0, PROOFREAD_LIMITS.suggestions), dropped };
}

/** The chapter with the proposal taken over; `null` when the span is gone. */
export function applySuggestion(
  chapter: string,
  s: Pick<ProofreadSuggestion, "quote" | "suggestion">,
): string | null {
  const i = chapter.indexOf(s.quote);
  if (i < 0) return null;
  return chapter.slice(0, i) + s.suggestion + chapter.slice(i + s.quote.length);
}
