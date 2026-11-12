/**
 * The internship and thesis track's server side (P38.2): the route gate (404 while the part is
 * off), the tool page's link to a track, and keeping a result's feedback as a round. Only the
 * feedback goes in, never the report (`redactedText` stays empty for a kept result).
 */
import { IsoDateSchema } from "~/lib/calendar/weeks";
import { getMessages, type Locale } from "~/lib/i18n";
import { feedbackHistory, MilestoneIdSchema, type MilestoneId, weakPoints } from "~/lib/tracks";
import type { User } from "./auth.server";
import { isFeatureOn } from "./availability.server";
import { requireFeatureUser } from "./features.server";
import { getAssessmentModel } from "./repositories/assessmentModels.server";
import { getGeneration } from "./repositories/generations.server";
import {
  addRound,
  getTrack,
  listRounds,
  type Track,
  updateTrackData,
} from "./repositories/tracks.server";

export const requireTracksUser = (request: Request): Promise<User> =>
  requireFeatureUser(request, "supervisionTracks");

export interface ForTrack {
  trackId: string;
  code: string;
  milestone: MilestoneId;
  /** P38.4: the track's earlier feedback, oldest first; the final assessment follows it up. */
  feedbackHistory: string;
  /** P38.6: the linked assessment model's framework; "" without one. */
  criteria: string;
  /** P38.6: the improvement points of the newest feedforward round, to rehearse. */
  weakPoints: string;
}

/** A tool opened from a track (`?track=&milestone=`): only an own track counts, else null. */
export async function forTrack(
  user: User,
  params: URLSearchParams,
  locale: Locale,
): Promise<ForTrack | null> {
  const milestone = MilestoneIdSchema.safeParse(params.get("milestone"));
  const trackId = params.get("track");
  if (!trackId || !milestone.success) return null;
  if (!(await isFeatureOn(user, "supervisionTracks"))) return null;
  const track = await getTrack(user.id, trackId);
  if (!track || track.closedAt) return null;
  const [rounds, model] = await Promise.all([
    listRounds(user.id, track.id),
    track.assessmentModelId ? getAssessmentModel(user.id, track.assessmentModelId) : null,
  ]);
  return {
    trackId: track.id,
    code: track.code,
    milestone: milestone.data,
    feedbackHistory: feedbackHistory(rounds, locale),
    criteria: model?.data.framework ?? "",
    weakPoints: weakPoints(rounds),
  };
}

/** Keep the output of the caller's own saved work as a round of the caller's own open track. */
export async function addGenerationToTrack(
  user: User,
  input: { generationId: string; trackId: string; milestone: string },
): Promise<boolean> {
  if (!(await isFeatureOn(user, "supervisionTracks"))) return false;
  const milestone = MilestoneIdSchema.safeParse(input.milestone);
  if (!milestone.success) return false;
  const track = await getTrack(user.id, input.trackId);
  if (!track || track.closedAt) return false;
  const generation = await getGeneration(user.id, input.generationId);
  if (!generation?.outputMarkdown.trim()) return false;
  const round = await addRound(user.id, input.trackId, {
    milestone: milestone.data,
    redactedText: "",
    feedback: { text: generation.outputMarkdown },
  }).catch(() => null);
  return round !== null;
}

const VisitDate = IsoDateSchema;

/** The `visit` intent (P38.6): only that there was a visit and when; null for other intents. */
export async function trackVisitAction(
  request: Request,
  user: User,
  track: Track,
  locale: Locale,
): Promise<{ ok: true; intent: "visit" } | { ok: false; intent: "visit"; error: string } | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "visit") return null;
  const m = getMessages(locale).tracks.visits;
  const date = VisitDate.safeParse(fd.get("date"));
  if (track.closedAt) return { ok: false, intent: "visit", error: m.errorClosed };
  if (!date.success) return { ok: false, intent: "visit", error: m.errorDate };
  const saved = await updateTrackData(user.id, track.id, {
    ...track.data,
    visits: [...track.data.visits, date.data],
  });
  return saved ? { ok: true, intent: "visit" } : { ok: false, intent: "visit", error: m.errorDate };
}
