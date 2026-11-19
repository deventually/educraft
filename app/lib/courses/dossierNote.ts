/**
 * The AI's concept for the teacher's notes on a test analysis in the test dossier (brief P35.2).
 * The BKE asks for the teacher's own analysis, so the model writes a concept the teacher rewrites,
 * with one or two reflection questions. Pure: the message to the model and the check of its answer.
 *
 * The check lives in code: a sentence that names a number not in the input (the numbers, the pass
 * mark, the test info) or a question that is not in the analysis table is dropped. The earlier AI
 * explanation goes along as context, but is never a source of numbers.
 */
import { z } from "zod";
import { extractJson, wrapAsData } from "~/lib/ai/structuredAnswer";
import { COURSE_LIMITS } from "./schema";

export const DOSSIER_NOTE_LIMITS = {
  /** The draft fits in the note it becomes. */
  note: COURSE_LIMITS.longText,
  numbers: 8_000,
  testInfo: 1_000,
  explanation: 6_000,
  questions: 2,
  question: 300,
} as const;

export interface DossierNoteInput {
  test: string;
  passMark?: number;
  /** The numbers of the linked analysis, as the teacher pasted or computed them. */
  numbers: string;
  /** What the teacher said about the test in the analysis tool. */
  testInfo?: string;
  /** The analysis tool's earlier explanation: context only, its numbers do not count. */
  explanation?: string;
}

export interface DossierNote {
  draft: string;
  questions: string[];
  /** Sentences and questions the code left out: a number or question not in the input. */
  dropped: number;
}

export function buildDossierNoteMessage(input: DossierNoteInput): string {
  const parts = [
    `<test>${input.test.trim().slice(0, COURSE_LIMITS.title)}</test>`,
    input.passMark === undefined ? "" : `<passMark>${input.passMark}</passMark>`,
    wrapAsData("analysis", input.numbers.trim(), DOSSIER_NOTE_LIMITS.numbers),
    input.testInfo?.trim()
      ? wrapAsData("testInfo", input.testInfo.trim(), DOSSIER_NOTE_LIMITS.testInfo)
      : "",
    input.explanation?.trim()
      ? wrapAsData("earlierExplanation", input.explanation.trim(), DOSSIER_NOTE_LIMITS.explanation)
      : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

// ── Checking the answer ─────────────────────────────────────────────────────

const NUMBER = /\d+(?:[.,]\d+)?/g;

/** A number as a comparable key: "0,80", "0.8" and "-0,8" are the same. */
const numberKey = (token: string) => String(Number(token.replace(",", ".")));

const numbersIn = (text: string) => new Set((text.match(NUMBER) ?? []).map(numberKey));

/** The question numbers of the analysis table: the digits of each row's first cell. */
function questionNumbers(numbers: string): Set<string> {
  const out = new Set<string>();
  for (const line of numbers.split("\n")) {
    const first = /^\s*\|([^|]*)\|/.exec(line)?.[1]?.trim() ?? "";
    const n = /^\D{0,12}?(\d+)\D{0,3}$/.exec(first)?.[1];
    if (n) out.add(String(Number(n)));
  }
  return out;
}

/** The question numbers a sentence refers to: "vraag 7", "vragen 3 en 4", "V7", "Q7". */
export function referredQuestions(sentence: string): string[] {
  const named =
    /\b(?:vraag|vragen|question|questions|item|items|opgave|opgaven)\s+(\d+(?:\s*(?:,|en|and|of|or|&)\s*\d+)*)/gi;
  const short = /\b[VQ](\d+)\b/g;
  return [
    ...[...sentence.matchAll(named)].flatMap((m) => m[1]?.match(/\d+/g) ?? []),
    ...[...sentence.matchAll(short)].map((m) => m[1] ?? ""),
  ].map((n) => String(Number(n)));
}

const sentencesOf = (paragraph: string) =>
  paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const RawAnswer = z.object({
  draft: z.string(),
  questions: z.array(z.unknown()).default([]),
});

export type DossierNoteParseResult = { ok: true; note: DossierNote } | { ok: false };

export function parseDossierNote(raw: string, input: DossierNoteInput): DossierNoteParseResult {
  const answer = RawAnswer.safeParse(extractJson(raw));
  if (!answer.success) return { ok: false };
  const allowed = numbersIn(
    [input.test, input.passMark ?? "", input.numbers, input.testInfo ?? ""].join("\n"),
  );
  const asked = questionNumbers(input.numbers);
  let dropped = 0;
  const keeps = (sentence: string) => {
    const ok =
      [...numbersIn(sentence)].every((n) => allowed.has(n)) &&
      (asked.size === 0 || referredQuestions(sentence).every((n) => asked.has(n)));
    if (!ok) dropped++;
    return ok;
  };

  let room = DOSSIER_NOTE_LIMITS.note;
  const paragraphs = answer.data.draft
    .split(/\n{2,}/)
    .map((p) =>
      sentencesOf(p)
        .filter(keeps)
        .filter((s) => {
          // A draft that is too long ends at the last sentence that fits.
          room -= s.length + 2;
          return room >= 0;
        })
        .join(" "),
    )
    .filter(Boolean);
  const draft = paragraphs.join("\n\n");
  if (!draft) return { ok: false };

  const questions = answer.data.questions
    .flatMap((q) => (typeof q === "string" ? [q.trim()] : []))
    .filter((q) => q.endsWith("?") && q.length <= DOSSIER_NOTE_LIMITS.question)
    .filter(keeps)
    .slice(0, DOSSIER_NOTE_LIMITS.questions);
  return { ok: true, note: { draft, questions, dropped } };
}
