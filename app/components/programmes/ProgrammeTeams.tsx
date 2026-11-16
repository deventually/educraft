import { AddDialog, type AddOption } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * The teams of a programme (BESLUIT-2026-11-16-1 and -4): everyone sees them. "Team toevoegen"
 * offers what this person may add (an admin any team, a lead the teams they lead), and
 * Weghalen, which asks first, sits on the teams they speak for (`myTeamIds`).
 */
export function ProgrammeTeams({
  programme,
  teamOptions,
  myTeamIds,
  isAdmin = false,
}: {
  programme: { name: string; teams: { id: string; name: string }[] };
  teamOptions: AddOption[];
  myTeamIds: string[];
  /** An admin always sees Team toevoegen, so the way to link is never hidden. */
  isAdmin?: boolean;
}) {
  const p = useT().programmes;
  return (
    <ConnectionList
      title={p.teams}
      intro={p.teamsIntro}
      empty={p.teamsEmpty}
      add={
        (isAdmin || teamOptions.length > 0) && (
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
        remove: myTeamIds.includes(t.id)
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
