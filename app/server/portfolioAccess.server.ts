/**
 * Who may use the BDB/BKE workplace (brief P27, BESLUIT-2026-11-05-4): an admin
 * switches it on per teacher. Never set means off, except for a teacher who
 * already has a dossier (the transition: nobody loses their work). An admin
 * always has it. Switched off, the workplace is a 404; nothing is deleted.
 */
import { hasDossier } from "./repositories/portfolio.server";
import { getPortfolioEnabled } from "./repositories/users.server";

export async function portfolioAccess(user: { id: string; role: string }): Promise<boolean> {
  if (user.role === "admin") return true;
  return (await getPortfolioEnabled(user.id)) ?? (await hasDossier(user.id));
}
