import { Link } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

const link =
  "rounded text-sm font-medium text-violet-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * The programmes of a team (admin team page, BESLUIT-2026-11-16-1), in the fixed pattern
 * (plan step 3): "Opleiding toevoegen" adds programmes of other teams, Weghalen asks first.
 * Where the team is a programme's only team there is no Weghalen (a programme keeps one
 * team) but a line that says so, and Opleiding verwijderen, which also asks first.
 */
export function TeamProgrammes({
  team,
  programmes,
  others,
}: {
  team: { id: string; name: string };
  programmes: { id: string; name: string; onlyTeam: boolean }[];
  others: { id: string; name: string; teamName: string }[];
}) {
  const t = useT();
  const tt = t.teams;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <ConnectionList
        title={tt.programmesHeading}
        headingLevel={3}
        intro={tt.programmesLinkHint}
        empty={tt.programmesNone}
        add={
          <div className="flex flex-wrap items-center gap-3">
            <Link to={`/programmes?team=${encodeURIComponent(team.id)}`} className={link}>
              {tt.programmesNew}
            </Link>
            {others.length > 0 && (
              <AddDialog
                triggerLabel={tt.programmesAdd}
                title={fmt(tt.programmesAddTitle, { team: team.name })}
                description={tt.programmesLinkHint}
                intent="linkProgramme"
                pick={{
                  name: "programmeId",
                  options: others.map((p) => ({ id: p.id, label: p.name, hint: p.teamName })),
                  empty: tt.programmesAddNone,
                }}
              />
            )}
          </div>
        }
        items={programmes.map((p) => ({
          id: p.id,
          name: p.name,
          href: `/programmes/${p.id}`,
          meta: p.onlyTeam ? tt.programmesOnlyTeam : undefined,
          actions: p.onlyTeam && (
            <ConfirmDialog
              triggerLabel={tt.programmeDelete}
              triggerContext={p.name}
              triggerVariant="ghost"
              title={tt.programmeDeleteTitle}
              description={fmt(tt.programmeDeleteBody, { name: p.name })}
              confirmLabel={t.programmes.delete}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "deleteProgramme", programmeId: p.id }}
            />
          ),
          remove: p.onlyTeam
            ? undefined
            : {
                fields: { intent: "unlinkProgramme", programmeId: p.id },
                title: fmt(tt.programmeRemoveTitle, { team: team.name, programme: p.name }),
                description: tt.programmeRemoveBody,
              },
        }))}
      />
    </div>
  );
}
