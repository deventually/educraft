/**
 * Course import, the server half (brief P26, 26.3): gates, the model call, the
 * checks from `app/lib/courses/import.ts`, one retry. Returns a PROPOSAL and
 * stores nothing; the teacher picks, and `import-apply` adds what was picked.
 */
import { buildImportMessage, type ImportProposal, parseImport } from "~/lib/courses/import";
import type { CourseData } from "~/lib/courses/types";
import type { Locale } from "~/lib/i18n";
import type { User } from "./auth.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { log } from "./log.server";

export type CourseImportError = "empty-document" | "quota" | "failed" | "nothing";

export type CourseImportResult =
  | { ok: true; proposal: ImportProposal; flagged: number; clipped: boolean }
  /** `notes`: the model's own explanation when it found nothing to import. */
  | { ok: false; error: CourseImportError; notes?: string };

const PROMPT_ID = "course-import@v1";
const EVENT = "course-import";

export async function extractCourseImport(
  user: User,
  course: CourseData,
  documentText: string,
  courseName: string,
  locale: Locale,
): Promise<CourseImportResult> {
  if (!documentText.trim()) return { ok: false, error: "empty-document" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const message = buildImportMessage(documentText, courseName);
  // One retry: a malformed answer is rare, and the second call usually fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(user, PROMPT_ID, message, locale, 8_000, EVENT);
    if (!answer) break;
    const parsed = parseImport(answer.text, documentText, course);
    if (parsed.ok) {
      log(EVENT, { outcome: "proposed", flagged: parsed.flagged, clipped: parsed.clipped });
      return parsed;
    }
    // A valid answer with nothing in it is the model's verdict on the document,
    // not a glitch: asking again costs a call and gives the same answer.
    if (parsed.error === "empty") {
      log(EVENT, { outcome: "nothing", attempt });
      return { ok: false, error: "nothing", ...(parsed.notes ? { notes: parsed.notes } : {}) };
    }
    log(EVENT, { outcome: "rejected", reason: parsed.error, attempt });
  }
  return { ok: false, error: "failed" };
}
