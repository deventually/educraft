import type { Messages } from "~/lib/i18n";

/** The text of a teams error code (the admin teams page and the lead's page, P28.2). */
export function teamError(t: Messages, code: string): string {
  const map: Record<string, string> = {
    nameRequired: t.teams.nameRequired,
    noSuchUser: t.teams.noSuchUser,
    self: t.teams.selfError,
    notMember: t.teams.notMember,
    noneSelected: t.teams.noneSelected,
    chooseDivision: t.teams.chooseDivision,
    hasProgrammes: t.teams.hasProgrammes,
    atLeastOne: t.admin.models.atLeastOne,
    invalid: t.error.invalidRequest,
  };
  return map[code] ?? t.error.generic;
}
