import { Link } from "react-router";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

const link =
  "rounded text-sm font-medium text-violet-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * The programmes a team works on, on the admin's and the lead's team page
 * (BESLUIT-2026-11-16-4), in the fixed pattern (plan step 3): "Opleiding toevoegen" puts the
 * team in programmes of the institution, with their faculty; Weghalen asks first, and the
 * programme stays. "Nieuwe opleiding voor dit team" starts one with this team.
 */
export function TeamProgrammes({
  team,
  programmes,
  choices,
  headingLevel = 3,
}: {
  team: { id: string; name: string };
  programmes: { id: string; name: string }[];
  choices: { id: string; name: string; divisionName: string | null }[];
  headingLevel?: 2 | 3;
}) {
  const tt = useT().teams;
  return (
    <ConnectionList
      title={tt.programmesHeading}
      headingLevel={headingLevel}
      intro={tt.programmesLinkHint}
      empty={tt.programmesNone}
      add={
        <div className="flex flex-wrap items-center gap-3">
          <Link to={`/programmes?team=${encodeURIComponent(team.id)}`} className={link}>
            {tt.programmesNew}
          </Link>
          {choices.length > 0 && (
            <AddDialog
              triggerLabel={tt.programmesAdd}
              title={fmt(tt.programmesAddTitle, { team: team.name })}
              description={tt.programmesLinkHint}
              intent="linkProgramme"
              pick={{
                name: "programmeId",
                options: choices.map((p) => ({
                  id: p.id,
                  label: p.name,
                  hint: p.divisionName ?? undefined,
                })),
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
        remove: {
          fields: { intent: "unlinkProgramme", programmeId: p.id },
          title: fmt(tt.programmeRemoveTitle, { team: team.name, programme: p.name }),
          description: tt.programmeRemoveBody,
        },
      }))}
    />
  );
}
