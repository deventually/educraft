/**
 * Who may use the BDB/BKE workplace (P27, P28.3): the feature `portfolio` through the
 * three-layer rule (instance, team, exception). An admin always has it (P27.2). The transition: a teacher who already has a dossier and for whom nothing was
 * chosen (the instance default, On request) keeps it, so nobody loses their work.
 * Switched off, the workplace is a 404; nothing is deleted.
 */
import { effectiveFeatures } from "./availability.server";
import { hasDossier } from "./repositories/portfolio.server";

export async function portfolioAccess(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "admin") return true;
  const stand = (await effectiveFeatures(user)).portfolio;
  if (stand.on) return true;
  return stand.source === "default" && (await hasDossier(user.id));
}
