/**
 * Pure helpers for the rehearsal-assessment eval (`npm run eval:rehearsal`,
 * brief P29, 29.2): the case shape, the transcript the judge reads, and the
 * hard checks that are counted in code instead of judged.
 */
import type { RehearsalFeedback, RehearsalLength } from "../app/lib/portfolio/rehearsal";
import type { DossierData } from "../app/lib/portfolio/types";

export interface RehearsalCase {
  id: string;
  description: string;
  locale: "nl" | "en";
  length: RehearsalLength;
  /** A synthetic dossier (never real data). */
  dossier: DossierData;
  /** The key of the thinnest criterion, where the first question should go. */
  thinnest?: string;
  /** The scripted teacher: REHEARSAL_START first, REHEARSAL_CLOSE last. */
  teacherTurns: string[];
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

const COMMITTEE = "**Committee:**";
const TEACHER = "**Teacher:**";

/** The transcript as the judge reads it: the teacher is the user, the committee the model. */
export function formatTranscript(turns: Turn[]): string {
  return turns
    .map((t) => `${t.role === "user" ? TEACHER : COMMITTEE} ${t.content}`)
    .join("\n\n");
}

/** The committee's turns, the last one being the feedback. */
export function committeeTurns(transcript: string): string[] {
  return transcript
    .split(/\n\n(?=\*\*(?:Committee|Teacher):\*\*)/)
    .filter((block) => block.startsWith(COMMITTEE))
    .map((block) => block.slice(COMMITTEE.length).trim());
}

export interface CountedInput {
  transcript: string;
  /** The feedback after the code checks; null when it did not parse. */
  feedback: RehearsalFeedback | null;
}

/**
 * Text without what it quotes: a question the committee quotes from the chapter
 * ('Waar wacht een klant het langst?') is not a question it asks. A single quote
 * opens only after a non-letter, so "zo'n" stays.
 */
export function withoutQuotes(text: string): string {
  return text
    .replace(/["“][^"”]*["”]/g, "")
    .replace(/(^|[^\p{L}])['‘][^'’]*['’](?!\p{L})/gu, "$1");
}

/** Hard checks decided in code (true = the failure happened). */
export const REHEARSAL_COUNTED: Record<string, (input: CountedInput) => boolean> = {
  /** More than one question mark in any interview turn (the feedback and quoted text excluded). */
  severalQuestions: ({ transcript }) =>
    committeeTurns(transcript)
      .slice(0, -1)
      .some((turn) => (withoutQuotes(turn).match(/\?/g) ?? []).length > 1),
  feedbackUnparsed: ({ feedback }) => feedback === null,
  /** A quote the teacher never typed (dropped by `parseRehearsalFeedback`). */
  fabricatedQuote: ({ feedback }) => !!feedback?.criteria.some((c) => c.quoteUnverified),
};
