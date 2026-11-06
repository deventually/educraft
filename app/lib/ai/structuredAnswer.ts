/**
 * The shared half of every "the model answers in JSON" call (P25.4 framework
 * extraction, P26.3 course import, the coach and the role agents): the input
 * goes in as tagged data with a size bound, the first JSON object comes out of
 * the answer, and text the model claims to copy is checked against the source.
 * Pure: no server, no provider.
 */
import { normalizeForMatch } from "~/lib/documents/locate";

/** At most this much document text goes to the model (cost and context bound). */
export const STRUCTURED_INPUT_LIMIT = 80_000;

/** `<tag>text</tag>`: the source as data, clipped at the input limit. */
export function wrapAsData(tag: string, text: string, limit = STRUCTURED_INPUT_LIMIT): string {
  const body = text.length <= limit ? text : `${text.slice(0, limit)}\n[…]`;
  return `<${tag}>\n${body}\n</${tag}>`;
}

/** The first JSON object in a model answer, fenced or not; `undefined` when there is none. */
export function extractJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw)?.[1];
  const text = fenced ?? raw;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/**
 * Is `text` in the source, ignoring layout, case and a closing punctuation
 * mark? `sourceNormalized` is `normalizeForMatch(source)`, computed once.
 */
export function verbatimIn(text: string, sourceNormalized: string): boolean {
  const needle = normalizeForMatch(text).replace(/[.;:]$/, "");
  return needle.length > 0 && sourceNormalized.includes(needle);
}
