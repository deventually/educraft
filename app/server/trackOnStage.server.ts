/**
 * Ready for OnStage and closing a track (brief P38.7), the server half: the `onstage` intent keeps
 * the confirmed text per criterion; the `close` intent closes the track, which sets when it is
 * wiped. Both only on the caller's own open track (the route loaded it owner-scoped).
 */
import { z } from "zod";
import { getMessages, type Locale } from "~/lib/i18n";
import { ConfirmedTextSchema } from "~/lib/tracks";
import type { User } from "./auth.server";
import { closeTrack, type Track, updateTrackData } from "./repositories/tracks.server";

const ConfirmedSchema = z.array(ConfirmedTextSchema).min(1).max(60);

type Result<I extends string> = { ok: true; intent: I } | { ok: false; intent: I; error: string };

/** The `onstage` intent; null for any other intent. */
export async function trackOnStageAction(
  request: Request,
  user: User,
  track: Track,
  locale: Locale,
): Promise<Result<"onstage"> | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "onstage") return null;
  const m = getMessages(locale).tracks.onstage;
  if (track.closedAt) return { ok: false, intent: "onstage", error: m.errorClosed };
  const criteria = fd.getAll("criterion").map(String);
  const texts = fd.getAll("text").map(String);
  const parsed = ConfirmedSchema.safeParse(
    criteria.map((criterion, i) => ({ criterion, text: texts[i] })),
  );
  if (!parsed.success || criteria.length !== texts.length)
    return { ok: false, intent: "onstage", error: m.errorInvalid };
  const saved = await updateTrackData(user.id, track.id, { ...track.data, onstage: parsed.data });
  return saved
    ? { ok: true, intent: "onstage" }
    : { ok: false, intent: "onstage", error: m.errorInvalid };
}

/** The `close` intent; null for any other intent. */
export async function trackCloseAction(
  request: Request,
  user: User,
  track: Track,
  locale: Locale,
): Promise<Result<"close"> | null> {
  const fd = await request.clone().formData();
  if (fd.get("intent") !== "close") return null;
  const m = getMessages(locale).tracks.close;
  if (track.closedAt) return { ok: false, intent: "close", error: m.errorClosed };
  const closed = await closeTrack(user.id, track.id);
  return closed
    ? { ok: true, intent: "close" }
    : { ok: false, intent: "close", error: m.errorClosed };
}
