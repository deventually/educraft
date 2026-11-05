import type { Messages } from "~/lib/i18n";

/** The text of a teams error code (the admin teams page and the lead's page, P28.2). */
export function teamError(t: Messages, code: string): string {
  const map: Record<string, string> = {
    nameRequired: t.teams.nameRequired,
    noSuchUser: t.teams.noSuchUser,
    isLead: t.teams.isLeadError,
    notMember: t.teams.notMember,
  };
  return map[code] ?? t.error.generic;
}
