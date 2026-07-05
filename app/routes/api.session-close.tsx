import type { Route } from "./+types/api.session-close";
import { z } from "zod";
import { requireUser } from "~/server/auth.server";
import { getChatSession, getSessionMessages } from "~/server/repositories/chat.server";
import { getSummary, saveSummary } from "~/server/repositories/insight.server";
import { summariseSession } from "~/lib/insight/summarise";
import { clampHelpfulness, parseSessionSummary, type SessionSummary } from "~/lib/insight/summary";
import { buildChatTranscript } from "~/lib/chat/transcript";
import { providerForModel } from "~/lib/ai/provider";
import { DEFAULT_MODEL } from "~/lib/ai/models";
import { getLocale } from "~/lib/i18n/locale.server";
import type { ChatMessage, OutputLanguage } from "~/lib/registry/types";

// Only summarise a conversation with enough substance to be worth the cost.
const MIN_MESSAGES_TO_SUMMARISE = 4;
// The summariser stays on an Anthropic model (non-Anthropic models are out of
// scope for Phase 7). Fixed + fast, independent of the tutor's own model.
const SUMMARY_MODEL = DEFAULT_MODEL;

const EMPTY_SUMMARY: SessionSummary = {
  topicsWorkedOn: [],
  skillsProgressed: [],
  misconceptions: [],
  effort: "unclear",
};

const CloseSchema = z.object({
  sessionId: z.string().min(8).max(100),
  // −1 / 0 / +1, clamped server-side; nullable when the student skips it.
  helpfulness: z.number().nullish(),
});

/**
 * Resource route (no UI): a student ends a chat session. Records the optional
 * self-reported helpfulness and runs the post-session summariser — which emits
 * only a de-personalised, leak-checked learning signal for the mentor (never the
 * raw transcript). Ownership-scoped: a caller may only close their own session,
 * and only a cohort-linked session produces a mentor-visible summary.
 */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const parsed = CloseSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const session = await getChatSession(parsed.data.sessionId);
  // Ownership gate: only the student who owns the session may close it.
  if (!session || session.userId !== user.id) {
    return Response.json({ ok: false }, { status: 403 });
  }
  // Insight is cohort-scoped: a session with no cohort has no mentor to inform.
  if (!session.cohortId) return Response.json({ ok: true });

  const helpfulness = clampHelpfulness(parsed.data.helpfulness);

  // Idempotent: a second close (e.g. after the student adds a rating) reuses the
  // already-summarised session rather than paying for another model call.
  const existing = await getSummary(session.id);
  if (existing) {
    await saveSummary({
      sessionId: session.id,
      userId: session.userId,
      cohortId: session.cohortId,
      toolSlug: session.toolSlug,
      summary: parseSessionSummary(existing.summaryJson) ?? EMPTY_SUMMARY,
      helpfulness,
    });
    return Response.json({ ok: true });
  }

  const stored = await getSessionMessages(session.id);
  const outputLanguage: OutputLanguage = getLocale(request) === "en" ? "en" : "nl";

  let summary: SessionSummary = EMPTY_SUMMARY;
  if (stored.length >= MIN_MESSAGES_TO_SUMMARISE) {
    const chatMessages: ChatMessage[] = stored.map((m) => ({
      role: m.role as ChatMessage["role"],
      content: m.content,
    }));
    const transcript = buildChatTranscript(chatMessages, outputLanguage);
    try {
      const result = await summariseSession({
        transcript,
        outputLanguage,
        complete: async ({ system, user: userMsg }) => {
          const { text } = await providerForModel(SUMMARY_MODEL).generate({
            model: SUMMARY_MODEL,
            system,
            messages: [{ role: "user", content: userMsg }],
            temperature: 0.2,
            maxTokens: 700,
          });
          return text;
        },
      });
      if (result) summary = result;
    } catch (e) {
      // Best-effort: a summariser failure must not fail the close. The student's
      // self-report is still recorded below.
      console.error("session-summary failed:", e);
    }
  }

  await saveSummary({
    sessionId: session.id,
    userId: session.userId,
    cohortId: session.cohortId,
    toolSlug: session.toolSlug,
    summary,
    helpfulness,
  });

  return Response.json({ ok: true });
}
