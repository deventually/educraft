/**
 * Finding a quote from the AI result back in the original document (24.0c).
 *
 * Pure and browser-free. The viewer hands over the original's text in segments
 * (PDF pages, or Word paragraphs) and gets back where a quote starts, with
 * offsets into the ORIGINAL segment text so it can be marked there. Matching is
 * forgiving about layout (line breaks, hyphenation, typographic quotes, case)
 * but never about wording: a paraphrase is "not found", not a near miss.
 */

/** Shorter needles than this (normalized) match too much to be trusted. */
const MIN_QUOTE_LENGTH = 12;

export type LocateResult =
  | { status: "found"; segment: number; start: number; end: number; matches: number }
  | { status: "notFound" }
  | { status: "tooShort" };

export interface Hit {
  segment: number;
  /** Offsets into the original segment text (end is clipped to the segment). */
  start: number;
  end: number;
}

const DROP = /[­​-‍﻿]/; // soft hyphen, zero-width chars
const DOUBLE_QUOTES = /[“”„‟«»″]/;
const SINGLE_QUOTES = /[‘’‚‛′]/;
const DASHES = /[‐‑‒–—―]/;
const LETTER = /\p{L}/u;
const SPACE = /\s/;

interface Normalized {
  text: string;
  /** For each char of `text`, its index in the source string. */
  map: number[];
}

function normalizeWithMap(source: string): Normalized {
  const out: string[] = [];
  const map: number[] = [];
  const push = (ch: string, at: number) => {
    out.push(ch);
    map.push(at);
  };

  for (let i = 0; i < source.length; i++) {
    let ch = source.charAt(i);
    if (DROP.test(ch)) continue;
    if (SPACE.test(ch)) {
      if (out.length > 0 && out[out.length - 1] !== " ") push(" ", i);
      continue;
    }
    if (DOUBLE_QUOTES.test(ch)) ch = '"';
    else if (SINGLE_QUOTES.test(ch)) ch = "'";
    else if (DASHES.test(ch)) ch = "-";

    // A hyphen between letters (optionally followed by a line break) joins the
    // word: "feed-\nback" and "feed-back" both become "feedback". The same rule
    // runs on the quote, so an ordinary compound still matches itself.
    if (ch === "-") {
      const prev = out[out.length - 1];
      let j = i + 1;
      while (j < source.length && (SPACE.test(source.charAt(j)) || DROP.test(source.charAt(j))))
        j++;
      if (prev && LETTER.test(prev) && j < source.length && LETTER.test(source.charAt(j))) {
        i = j - 1;
        continue;
      }
    }

    const lower = ch.toLowerCase();
    push(lower.length === 1 ? lower : ch, i);
  }

  // Trim one trailing space (leading spaces are never pushed).
  if (out[out.length - 1] === " ") {
    out.pop();
    map.pop();
  }
  return { text: out.join(""), map };
}

/** Layout-insensitive form of a text, used on both sides of a match. */
export function normalizeForMatch(text: string): string {
  return normalizeWithMap(text).text;
}

const SEPARATOR = "\n";

/** Every occurrence of `needle` across the segments, in reading order. */
function findHits(segments: string[], needle: string): Hit[] {
  const starts: number[] = [];
  let joined = "";
  for (const [i, s] of segments.entries()) {
    if (i > 0) joined += SEPARATOR;
    starts.push(joined.length);
    joined += s;
  }
  const hay = normalizeWithMap(joined);
  const hits: Hit[] = [];
  if (!needle) return hits;

  const segmentOf = (pos: number) => {
    let seg = 0;
    while (seg + 1 < starts.length && (starts[seg + 1] ?? pos + 1) <= pos) seg++;
    return seg;
  };

  let from = 0;
  for (;;) {
    const at = hay.text.indexOf(needle, from);
    if (at < 0) break;
    // `at` and its last character are inside the text, so both are mapped.
    const srcStart = hay.map[at] ?? 0;
    const srcEnd = (hay.map[at + needle.length - 1] ?? 0) + 1;
    const segment = segmentOf(srcStart);
    const segStart = starts[segment] ?? 0;
    const segEnd = segStart + (segments[segment]?.length ?? 0);
    hits.push({ segment, start: srcStart - segStart, end: Math.min(srcEnd, segEnd) - segStart });
    from = at + Math.max(needle.length, 1);
  }
  return hits;
}

/** The search field: every match of a free query (at least 2 chars). */
export function locateAll(segments: string[], query: string): Hit[] {
  const needle = normalizeForMatch(query);
  if (needle.length < 2) return [];
  return findHits(segments, needle);
}

const ELLIPSIS = /…|\.{3}|\[\.\.\.\]|\(\.\.\.\)/;
const WRAPPING_QUOTES = /^["'\s]+|["'\s]+$/g;

/**
 * Where a quote from the result starts in the original. A quote that leaves
 * something out with an ellipsis is located by its longest verbatim fragment.
 */
export function locateQuote(segments: string[], quote: string): LocateResult {
  const fragments = quote
    .split(ELLIPSIS)
    .map((f) => normalizeForMatch(f).replace(WRAPPING_QUOTES, ""))
    .filter(Boolean);
  const needle = fragments.reduce((a, b) => (b.length > a.length ? b : a), "");
  if (needle.length < MIN_QUOTE_LENGTH) return { status: "tooShort" };
  const hits = findHits(segments, needle);
  const [first] = hits;
  if (!first) return { status: "notFound" };
  return { status: "found", ...first, matches: hits.length };
}

/** Quotes in a result shorter than this are words, not evidence. */
const MIN_EXTRACTED = 20;
const QUOTE_PATTERNS = [/“([^”\n]+)”/g, /„([^”“\n]+)[”“]/g, /"([^"\n]+)"/g, /‘([^’\n]+)’/g];

/**
 * The quoted passages in an AI result (typographic or straight double quotes,
 * and Markdown blockquotes), deduplicated, in order of appearance. Single
 * straight quotes are skipped: Dutch uses them as apostrophes ("auto's").
 */
export function extractQuotes(markdown: string): string[] {
  const found: Array<{ at: number; text: string }> = [];
  for (const pattern of QUOTE_PATTERNS) {
    for (const m of markdown.matchAll(pattern)) found.push({ at: m.index ?? 0, text: m[1] ?? "" });
  }
  for (const m of markdown.matchAll(/^\s*>\s?(.+)$/gm)) {
    found.push({ at: m.index ?? 0, text: m[1] ?? "" });
  }
  found.sort((a, b) => a.at - b.at);

  const seen = new Set<string>();
  const quotes: string[] = [];
  for (const { text } of found) {
    const clean = text.replace(/[*_`]/g, "").trim();
    const key = normalizeForMatch(clean);
    if (clean.length < MIN_EXTRACTED || seen.has(key)) continue;
    seen.add(key);
    quotes.push(clean);
  }
  return quotes;
}

/** The key two quotes share when they are the same passage (markup and layout aside). */
export function quoteKey(quote: string): string {
  return normalizeForMatch(quote.replace(/[*_`]/g, "").trim());
}

export interface QuoteSpan {
  /** Offsets into the text, including the quotation marks. */
  start: number;
  end: number;
  /** The passage between the marks, as `extractQuotes` returns it. */
  quote: string;
}

/**
 * The quoted passages in one piece of plain text (a text node of the rendered
 * result), with their place, so the result can turn each into a button. Uses
 * the same marks and minimum length as `extractQuotes`; overlapping matches keep
 * the first.
 */
export function quoteSpans(text: string): QuoteSpan[] {
  const spans: QuoteSpan[] = [];
  for (const pattern of QUOTE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const quote = (m[1] ?? "").replace(/[*_`]/g, "").trim();
      if (quote.length < MIN_EXTRACTED) continue;
      const start = m.index ?? 0;
      spans.push({ start, end: start + m[0].length, quote });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const kept: QuoteSpan[] = [];
  for (const span of spans) {
    const last = kept[kept.length - 1];
    if (!last || span.start >= last.end) kept.push(span);
  }
  return kept;
}
