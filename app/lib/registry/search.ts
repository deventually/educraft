/**
 * Tool search, shared by the catalogue (/tools) and the question box on Start (P27.3).
 * No AI (BESLUIT-2026-11-05-4, point 6): plain words against a haystack of name, subtitle,
 * tagline, theory and `TOOL_KEYWORDS`, in both languages.
 */
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { TOOL_KEYWORDS } from "./goals";
import type { Tool } from "./types";

/** Short words that say nothing about a task ("ik wil een les voor mijn groep"). */
const FILLER = new Set([
  "aan",
  "de",
  "een",
  "en",
  "het",
  "ik",
  "in",
  "met",
  "mijn",
  "op",
  "van",
  "voor",
  "wil",
  "a",
  "an",
  "and",
  "for",
  "i",
  "my",
  "the",
  "to",
  "want",
  "with",
]);

const both = (v: LocalizedText) => [loc(v, "nl"), loc(v, "en")].join(" ");

/** The lower-cased haystack one tool is searched by. */
export function toolSearchText(tool: Tool): string {
  return [
    both(tool.name),
    tool.subtitle ? both(tool.subtitle) : "",
    both(tool.tagline),
    both(tool.theory.name),
    (TOOL_KEYWORDS[tool.slug] ?? []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * The items whose haystack holds the most words of `query`, best first (ties keep their
 * order). One word behaves like a plain substring filter; an empty query returns all items.
 */
export function searchTools<T extends { search: string }>(
  items: T[],
  query: string,
  limit?: number,
): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  const meaningful = words.filter((w) => !FILLER.has(w));
  const terms = meaningful.length > 0 ? meaningful : words;
  const hits = items
    .map((item, i) => ({ item, i, score: terms.filter((w) => item.search.includes(w)).length }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((h) => h.item);
  return limit === undefined ? hits : hits.slice(0, limit);
}
