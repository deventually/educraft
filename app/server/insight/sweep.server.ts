/**
 * Abandoned-session sweep (Phase 7 fallback trigger). Explicit "End session"
 * (see `api.session-close`) is the primary summariser trigger; students who just
 * navigate away never fire it. This periodic sweep closes that gap: it finds
 * cohort-linked sessions that have gone idle without a summary, and runs the same
 * de-personalised summariser over them — recording signal for the mentor, with
 * no student self-report (they didn't close it).
 *
 * Cost is bounded three ways: only long-enough sessions qualify (`minMessages`),
 * a per-run `limit` caps how many are processed, and every processed session
 * gets a summary row (empty on failure) so it is never re-swept.
 *
 * This is a server-side summariser path — like the close endpoint it reads raw
 * messages to build the transcript. It is NOT a mentor-facing read (the insight
 * repo/route remain content-free).
 */
import type { ChatMessage, OutputLanguage } from "~/lib/registry/types";
import { getSessionMessages } from "~/server/repositories/chat.server";
import { listAbandonedSessions, saveSummary } from "~/server/repositories/insight.server";
import { summariseSession } from "~/lib/insight/summarise";
import { buildChatTranscript } from "~/lib/chat/transcript";
import type { SessionSummary } from "~/lib/insight/summary";

const DEFAULT_IDLE_MS = 2 * 60 * 60 * 1000; // 2h without a new turn = abandoned
const DEFAULT_MIN_MESSAGES = 4;
const DEFAULT_LIMIT = 50;

const EMPTY_SUMMARY: SessionSummary = {
  topicsWorkedOn: [],
  skillsProgressed: [],
  misconceptions: [],
  effort: "unclear",
};

export interface SweepOptions {
  /** Reference time (pass `new Date()` from the caller — scripts, not workflows). */
  now: Date;
  /** Idle threshold: a session with no message newer than `now - idleMs` qualifies. */
  idleMs?: number;
  minMessages?: number;
  /** Max sessions processed this run (cost cap). */
  limit?: number;
  /** Language for the summary's text values (conversation language isn't stored). */
  outputLanguage?: OutputLanguage;
  /** Injected model call — returns the raw completion text. */
  complete: (args: { system: string; user: string }) => Promise<string>;
}

export interface SweepResult {
  scanned: number;
  summarised: number;
  emptied: number;
}

/** Summarise abandoned, cohort-linked sessions. Returns per-run counts. */
export async function sweepAbandonedSessions(opts: SweepOptions): Promise<SweepResult> {
  const idleMs = opts.idleMs ?? DEFAULT_IDLE_MS;
  const minMessages = opts.minMessages ?? DEFAULT_MIN_MESSAGES;
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const outputLanguage: OutputLanguage = opts.outputLanguage ?? "nl";
  const before = new Date(opts.now.getTime() - idleMs);

  const candidates = await listAbandonedSessions({ before, minMessages, limit });
  let summarised = 0;
  let emptied = 0;

  for (const c of candidates) {
    const stored = await getSessionMessages(c.sessionId);
    const chatMessages: ChatMessage[] = stored.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));
    const transcript = buildChatTranscript(chatMessages, outputLanguage);

    let summary: SessionSummary = EMPTY_SUMMARY;
    try {
      const result = await summariseSession({
        transcript,
        outputLanguage,
        complete: opts.complete,
      });
      if (result) {
        summary = result;
        summarised++;
      } else {
        emptied++;
      }
    } catch (e) {
      console.error(`sweep: summary failed for ${c.sessionId}:`, e);
      emptied++;
    }

    // Record either way (empty on failure) so the session is marked processed and
    // never re-swept. No helpfulness: an abandoned session has no self-report.
    await saveSummary({
      sessionId: c.sessionId,
      userId: c.userId,
      cohortId: c.cohortId,
      toolSlug: c.toolSlug,
      summary,
      helpfulness: null,
    });
  }

  return { scanned: candidates.length, summarised, emptied };
}
