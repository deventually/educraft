import { AddDialog, type AddOption } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * The teams of a programme (BESLUIT-2026-11-16-1 and -4): everyone sees them; an admin or a
 * lead of one of them adds teams ("Team toevoegen") and takes one off (Weghalen, asks first).
 * The last team has no Weghalen: a programme always keeps one.
 */
export function ProgrammeTeams({
  programme,
  teamOptions,
}: {
  programme: { name: string; canManage: boolean; teams: { id: string; name: string }[] };
  teamOptions: AddOption[];
}) {
  const p = useT().programmes;
  const removable = programme.canManage && programme.teams.length > 1;
  return (
    <ConnectionList
      title={p.teams}
      intro={p.teamsIntro}
      empty=""
      add={
        programme.canManage && (
          <AddDialog
            triggerLabel={p.addTeam}
            title={fmt(p.addTeamTitle, { programme: programme.name })}
            description={p.addTeamHint}
            intent="link-teams"
            pick={{ name: "teamId", options: teamOptions, empty: p.addTeamNone }}
          />
        )
      }
      items={programme.teams.map((t) => ({
        id: t.id,
        name: t.name,
        remove: removable
          ? {
              fields: { intent: "unlink-team", teamId: t.id },
              title: fmt(p.removeTeamTitle, { team: t.name, programme: programme.name }),
              description: p.removeTeamBody,
            }
          : undefined,
      }))}
    />
  );
}
