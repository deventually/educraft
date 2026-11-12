/**
 * The internship and thesis track's server side (P38.2): the route gate (404 while the part is
 * off), the tool page's link to a track, and keeping a result's feedback as a round. Only the
 * feedback goes in, never the report (`redactedText` stays empty for a kept result).
 */
import { MilestoneIdSchema, type MilestoneId } from "~/lib/tracks";
import type { User } from "./auth.server";
import { isFeatureOn } from "./availability.server";
import { requireFeatureUser } from "./features.server";
import { getGeneration } from "./repositories/generations.server";
import { addRound, getTrack } from "./repositories/tracks.server";

export const requireTracksUser = (request: Request): Promise<User> =>
  requireFeatureUser(request, "supervisionTracks");

export interface ForTrack {
  trackId: string;
  code: string;
  milestone: MilestoneId;
}

/** A tool opened from a track (`?track=&milestone=`): only an own track counts, else null. */
export async function forTrack(user: User, params: URLSearchParams): Promise<ForTrack | null> {
  const milestone = MilestoneIdSchema.safeParse(params.get("milestone"));
  const trackId = params.get("track");
  if (!trackId || !milestone.success) return null;
  if (!(await isFeatureOn(user, "supervisionTracks"))) return null;
  const track = await getTrack(user.id, trackId);
  return track && !track.closedAt
    ? { trackId: track.id, code: track.code, milestone: milestone.data }
    : null;
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
