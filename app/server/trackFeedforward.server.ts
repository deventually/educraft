/**
 * Feedforward on a draft in a track (brief P38.3), the server half: the `feedforward` intent of
 * the track page. The draft is anonymised in the browser (the name check ran there); the criteria
 * come from the form (prefilled from the track's assessment model), the earlier points from the
 * track's last drafts round, the context from the linked course. `parseFeedforward` checks the
 * answer, with one retry. The round keeps the text that went to the AI and the feedback.
 */
import { z } from "zod";
import { forwardRetired } from "~/lib/ai/models";
import { formatProfile } from "~/lib/context/format";
import { getMessages, type Locale } from "~/lib/i18n";
import {
  buildFeedforwardMessage,
  FEEDFORWARD_LIMITS,
  type FeedbackPoint,
  feedforwardMarkdown,
  parseFeedforward,
  previousPoints,
} from "~/lib/tracks/feedforward";
import type { User } from "./auth.server";
import { runAiCall } from "./aiCalls.server";
import { isModelSelectableForUser } from "./availability.server";
import { syncModelRegistry } from "./modelRegistry.server";
import { callPortfolioModel, quotaGate } from "./portfolioAi.server";
import { getCourse } from "./repositories/courses.server";
import { getProfile } from "./repositories/profiles.server";
import { addRound, listRounds, type Track } from "./repositories/tracks.server";

const PROMPT_ID = "feedforward@v1";

const FormSchema = z.object({
  version: z.string().trim().min(1).max(FEEDFORWARD_LIMITS.version),
  criteria: z.string().trim().min(1).max(FEEDFORWARD_LIMITS.criteriaText),
  model: z.string().max(100).optional(),
});

type FeedforwardError = "invalid" | "closed" | "model" | "quota" | "failed";

/** The improvement points of the track's last drafts round: what the next round follows up. */
async function earlierPoints(user: User, track: Track): Promise<FeedbackPoint[]> {
  const drafts = (await listRounds(user.id, track.id)).filter((r) => r.milestone === "drafts");
  return drafts.at(-1)?.feedback.points ?? [];
}

async function contextOf(user: User, track: Track, locale: Locale): Promise<string> {
  if (!track.courseId) return "";
  const course = await getCourse(user.id, track.courseId);
  if (!course?.contextProfileId) return "";
  return formatProfile(await getProfile(course.ownerId, course.contextProfileId), locale);
}

async function feedforward(
  user: User,
  track: Track,
  fd: FormData,
  locale: Locale,
): Promise<{ ok: true } | { ok: false; error: FeedforwardError }> {
  if (track.closedAt) return { ok: false, error: "closed" };
  const v = FormSchema.safeParse({
    version: fd.get("version")?.toString() ?? "",
    criteria: fd.get("criteria")?.toString() ?? "",
    model: fd.get("model")?.toString() || undefined,
  });
  if (!v.success) return { ok: false, error: "invalid" };
  await syncModelRegistry();
  const model = v.data.model ? forwardRetired(v.data.model) : undefined;
  if (model && !(await isModelSelectableForUser(user, model))) return { ok: false, error: "model" };
  const blocked = await quotaGate(user);
  if (blocked) return { ok: false, error: blocked };

  const previous = await earlierPoints(user, track);
  const message = buildFeedforwardMessage({
    criteria: v.data.criteria,
    version: v.data.version,
    previous,
    context: await contextOf(user, track, locale),
  });
  // One retry: a second call usually fixes malformed JSON.
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await callPortfolioModel(
      user,
      PROMPT_ID,
      message,
      locale,
      4_000,
      "track-feedforward",
      model,
    );
    if (!answer) return { ok: false, error: "failed" };
    const parsed = parseFeedforward(answer.text, { version: v.data.version, previous });
    if (!parsed.ok) continue;
    const m = getMessages(locale).tracks.feedforward;
    const text = feedforwardMarkdown(parsed.result, previous, m.labels) || m.empty;
    const round = await addRound(user.id, track.id, {
      milestone: "drafts",
      redactedText: v.data.version,
      feedback: { text, points: previousPoints(parsed.result) },
    });
    return round ? { ok: true } : { ok: false, error: "failed" };
  }
  return { ok: false, error: "failed" };
}

/** The `feedforward` intent; null for any other intent. */
export async function trackFeedforwardAction(
  request: Request,
  user: User,
  track: Track,
  locale: Locale,
): Promise<
  { ok: true; intent: "feedforward" } | { ok: false; intent: "feedforward"; error: string } | null
> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "feedforward") return null;
  // The page's call id: leaving the page with "Stop" stops this model call.
  const r = await runAiCall(user.id, fd.get("aiCall"), () => feedforward(user, track, fd, locale));
  if (r.ok) return { ok: true, intent: "feedforward" };
  return {
    ok: false,
    intent: "feedforward",
    error: getMessages(locale).tracks.feedforward.errors[r.error],
  };
}
