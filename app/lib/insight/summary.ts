/**
 * Session-summary contract (Phase 7). The de-personalisation guarantee is
 * enforced here, at the boundary — the live model is only *asked* to comply
 * (its prompt), but this code is what *decides* whether an output may reach a
 * mentor. Two guards:
 *
 *  1. Shape — strict Zod parse. Malformed JSON or a missing key → rejected.
 *  2. Leakage — the parsed summary must carry no verbatim quote from the
 *     transcript and no sensitive personal disclosure. Either → rejected.
 *
 * A rejected output is dropped whole (no partial leak); the caller retries once
 * then skips. The unit tests pin this contract; an owner-run eval checks it on
 * real model output.
 */
import { z } from "zod";

export const EFFORT_VALUES = ["low", "moderate", "high", "unclear"] as const;
export type Effort = (typeof EFFORT_VALUES)[number];

export interface SessionSummary {
  /** Learning topics the session touched (about the material). */
  topicsWorkedOn: string[];
  /** Skills the learner made progress on. */
  skillsProgressed: string[];
  /** Conceptual misconceptions — about the material, never about the person. */
  misconceptions: string[];
  /** Coarse engagement signal. */
  effort: Effort;
}

const MAX_ITEMS = 20;

const RawSchema = z.object({
  topicsWorkedOn: z.array(z.string()),
  skillsProgressed: z.array(z.string()),
  misconceptions: z.array(z.string()),
  effort: z.string(),
});

/** Strip an optional ```json … ``` fence some models wrap JSON in. */
function unfence(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (m ? m[1] : t).trim();
}

function cleanList(items: string[]): string[] {
  return items
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_ITEMS);
}

function normaliseEffort(effort: string): Effort {
  const e = effort.trim().toLowerCase();
  return (EFFORT_VALUES as readonly string[]).includes(e) ? (e as Effort) : "unclear";
}

/**
 * Parse a raw model string into a `SessionSummary`, or `null` if it is not
 * well-formed JSON of the required shape. Lenient *within* the shape (trims,
 * caps list length, coerces an unknown effort to "unclear"); strict *about* it
 * (a missing key is a rejection).
 */
export function parseSessionSummary(raw: string): SessionSummary | null {
  let data: unknown;
  try {
    data = JSON.parse(unfence(raw));
  } catch {
    return null;
  }
  const parsed = RawSchema.safeParse(data);
  if (!parsed.success) return null;
  return {
    topicsWorkedOn: cleanList(parsed.data.topicsWorkedOn),
    skillsProgressed: cleanList(parsed.data.skillsProgressed),
    misconceptions: cleanList(parsed.data.misconceptions),
    effort: normaliseEffort(parsed.data.effort),
  };
}

/**
 * Clamp a student's self-rating to −1 / 0 / +1, or `null` if absent/non-numeric.
 * This is the one signal the student chooses to share.
 */
export function clampHelpfulness(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(-1, Math.min(1, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Leakage guard
// ---------------------------------------------------------------------------

// Person-focused / sensitive markers (NL + EN). A summary is about the *work*,
// so any of these in the derived signal is treated as a disclosure leak and the
// whole output is dropped. Fail-safe: a false positive costs a skipped summary,
// never a leak.
const SENSITIVE =
  /\b(faalangst|angst|anxiety|anxious|depress\w*|somber|gescheiden|scheiding|divorc\w*|pest(?:en|erij|gedrag)?|gepest|bully\w*|zelfmoord|suïcid\w*|suicid\w*|zelfbeschadig\w*|self.?harm|medicat\w*|medication|adhd|autis\w*|dyslex\w*|dyscalcul\w*|thuissituatie|mishandel\w*|trauma\w*|verslav\w*|addict\w*|eenzaam\w*|lonely|rouw|overleden|ziek(?:te|enhuis)?|burn.?out|stress(?:vol)?)\b/i;

const WORD = /[\p{L}\p{N}]+/gu;

function words(s: string): string[] {
  return (s.toLowerCase().match(WORD) ?? []) as string[];
}

/**
 * True when `text` shares a run of ≥ `minWords` consecutive words with the
 * transcript — the signature of a lifted verbatim quote.
 */
function sharesLongRun(text: string, transcript: string, minWords = 6): boolean {
  const t = words(text);
  const tr = words(transcript);
  if (t.length < minWords || tr.length < minWords) return false;
  const runs = new Set<string>();
  for (let i = 0; i + minWords <= tr.length; i++) {
    runs.add(tr.slice(i, i + minWords).join(" "));
  }
  for (let i = 0; i + minWords <= t.length; i++) {
    if (runs.has(t.slice(i, i + minWords).join(" "))) return true;
  }
  return false;
}

function hasQuotedSpan(text: string): boolean {
  // A quotation mark wrapping a substantial span reads as a lifted quote.
  return /["“”«»][^"“”«»]{15,}["“”«»]/.test(text);
}

export interface LeakageResult {
  ok: boolean;
  reason?: "quote" | "disclosure";
}

/** Check a parsed summary against the transcript for quote/disclosure leaks. */
export function checkLeakage(summary: SessionSummary, transcript: string): LeakageResult {
  const fields = [
    ...summary.topicsWorkedOn,
    ...summary.skillsProgressed,
    ...summary.misconceptions,
  ];
  for (const field of fields) {
    if (SENSITIVE.test(field)) return { ok: false, reason: "disclosure" };
  }
  for (const field of fields) {
    if (hasQuotedSpan(field) || sharesLongRun(field, transcript)) {
      return { ok: false, reason: "quote" };
    }
  }
  return { ok: true };
}

/**
 * Parse + de-personalise in one step: returns the summary only if it is
 * well-formed AND leak-free, else `null`.
 */
export function validateSummaryOutput(raw: string, transcript: string): SessionSummary | null {
  const summary = parseSessionSummary(raw);
  if (!summary) return null;
  return checkLeakage(summary, transcript).ok ? summary : null;
}
