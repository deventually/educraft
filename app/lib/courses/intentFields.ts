/**
 * Form fields of the course editor beyond the basics: an optional number, free text, one entry
 * per line, success criteria with a code, the test details and a part. Pure Zod, for
 * `intents.ts` and the import.
 */
import { z } from "zod";
import { COURSE_LIMITS } from "./schema";
import { GRADINGS, type SuccessCriterion } from "./types";

const Id = z.string().min(1).max(COURSE_LIMITS.id);
const required = (max: number) => z.string().trim().min(1).max(max);
const ids = z.array(Id).max(COURSE_LIMITS.outcomes).default([]);

/** An optional number from a text field: absent or "" means not set; a decimal comma is fine. */
export const optionalNumber = (min: number, max: number, int = false) =>
  z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d+)?)?$/)
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : undefined))
    .refine((n) => n === undefined || (n >= min && n <= max && (!int || Number.isInteger(n))));

/** Optional free text: trimmed, "" or absent means not set. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** One entry per non-empty line; none means not set. */
export const lines = (maxLine: number, maxLines: number) =>
  z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().max(maxLine)).max(maxLines))
    .transform((ls) => (ls.length ? ls : undefined));

/** "S-An 1.1: text" → a code and a text; a code is short and has a digit. */
const CRITERION = /^([^:]{1,20}):\s+(.+)$/;
export function criterion(line: string): SuccessCriterion {
  const m = CRITERION.exec(line);
  const code = m?.[1]?.trim();
  return m && code && /\d/.test(code) ? { code, text: (m[2] ?? "").trim() } : { text: line };
}

export const assessmentDetails = z.object({
  id: Id,
  form: optionalText(COURSE_LIMITS.title),
  owner: optionalText(COURSE_LIMITS.title),
  grading: z
    .enum([...GRADINGS, ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  passMark: optionalNumber(0, 100),
  conditions: lines(COURSE_LIMITS.text, COURSE_LIMITS.conditions),
  resit: optionalText(COURSE_LIMITS.longText),
  conduct: optionalText(COURSE_LIMITS.longText),
});

export const part = z.object({
  assessmentId: Id,
  title: required(COURSE_LIMITS.title),
  outcomeIds: ids,
  weight: optionalNumber(0, 100),
  knockOut: z
    .string()
    .optional()
    .transform((v) => (v ? true : undefined)),
  pass: optionalText(COURSE_LIMITS.longText),
  fail: optionalText(COURSE_LIMITS.longText),
});
