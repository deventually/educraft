/**
 * Route glue for sharing with your team (P28.4): the owner's "Delen met team" controls and
 * the "Van mijn team" list. The form body is parsed with Zod at the boundary; the
 * repository decides who may share what. Routes stay thin.
 */
import { z } from "zod";
import type { User } from "./auth.server";
import { listTeamsForUser } from "./repositories/teams.server";
import {
  listItemShares,
  listSharedWithMe,
  shareItem,
  stopSharing,
  type SharedItemRef,
} from "./repositories/shares.server";
import type { ShareKind } from "~/lib/sharing";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";

export interface ShareControls {
  /** The owner's teams; empty = no controls are shown. */
  teams: { id: string; name: string }[];
  /** The team ids the item is shared with. */
  sharedWith: string[];
}

export type ShareActionResult =
  | { ok: true; intent: "share" | "unshare"; message: string }
  | { ok: false; intent: "share" | "unshare"; error: string };

const ShareFormSchema = z.object({
  intent: z.enum(["share", "unshare"]),
  teamId: z.string().min(1).max(100),
});

/** What the owner's share controls need for one item. */
export async function shareControls(
  user: User,
  kind: ShareKind,
  itemId: string,
): Promise<ShareControls> {
  const [teams, sharedWith] = await Promise.all([
    listTeamsForUser(user.id),
    listItemShares(user.id, kind, itemId),
  ]);
  return { teams: teams.map((t) => ({ id: t.id, name: t.name })), sharedWith };
}

/**
 * Handles `intent=share|unshare` for one item, or returns null for any other intent so the
 * route's own action runs. Reads a clone, so the route can still read the body.
 */
export async function shareAction(
  request: Request,
  user: User,
  kind: ShareKind,
  itemId: string,
): Promise<ShareActionResult | null> {
  const fd = await request.clone().formData();
  const intent = fd.get("intent");
  if (intent !== "share" && intent !== "unshare") return null;
  const m = getMessages(getLocale(request)).sharing;
  const parsed = ShareFormSchema.safeParse({ intent, teamId: fd.get("teamId") });
  if (!parsed.success) return { ok: false, intent, error: m.errorShare };
  const { teamId } = parsed.data;
  if (intent === "share") {
    return (await shareItem(user.id, kind, itemId, teamId))
      ? { ok: true, intent, message: m.toastShared }
      : { ok: false, intent, error: m.errorShare };
  }
  await stopSharing(user.id, kind, itemId, teamId);
  return { ok: true, intent, message: m.toastStopped };
}

/** "Van mijn team" for a list page. */
export async function sharedWithMe(user: User, kind: ShareKind): Promise<SharedItemRef[]> {
  return listSharedWithMe(user.id, kind);
}
