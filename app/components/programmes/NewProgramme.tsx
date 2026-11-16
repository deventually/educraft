import { useId } from "react";
import { NewDialog } from "~/components/connections/NewDialog";
import { Label, Select } from "~/components/ui";
import { type KindOption, ProgrammeFields } from "~/components/programmes/ProgrammeFields";
import { useT } from "~/lib/i18n/useT";

/**
 * "Nieuwe opleiding" (plan step 3): one button that opens one dialog, on the programmes page
 * and in each faculty on Organisatie. It posts to /programmes, which opens the new programme.
 * A lead picks one of the teams they lead; an admin may start without a team and under a
 * faculty (BESLUIT-2026-11-16-4). With `division` the faculty is fixed.
 */
export function NewProgramme({
  kinds,
  teams,
  isAdmin = false,
  divisions = [],
  divisionWord,
  division,
  title,
  defaultTeam,
  startOpen = false,
  triggerId,
}: {
  kinds: KindOption[];
  teams: { id: string; name: string }[];
  isAdmin?: boolean;
  divisions?: { id: string; name: string }[];
  divisionWord?: string;
  /** Fixed: the faculty this programme starts in. */
  division?: { id: string; name: string };
  title?: string;
  defaultTeam?: string;
  startOpen?: boolean;
  triggerId?: string;
}) {
  const t = useT();
  const p = t.programmes;
  const id = useId();
  const defaultKind = kinds.some((k) => k.value === "hbo:bachelor") ? "hbo:bachelor" : "";
  return (
    <NewDialog
      triggerLabel={p.createTitle}
      triggerId={triggerId}
      title={title ?? p.createTitle}
      intent="create"
      action="/programmes"
      hidden={division ? { divisionId: division.id } : {}}
      submitLabel={p.create}
      startOpen={startOpen}
    >
      <div>
        <Label htmlFor={`${id}-team`}>{p.team}</Label>
        <Select
          id={`${id}-team`}
          name="teamId"
          defaultValue={defaultTeam ?? (isAdmin ? "" : teams[0]?.id)}
          className="mt-1"
          data-autofocus
        >
          {isAdmin && <option value="">{p.noTeamOption}</option>}
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </div>
      {isAdmin && !division && (
        <div>
          <Label htmlFor={`${id}-division`}>{divisionWord ?? p.division}</Label>
          <Select id={`${id}-division`} name="divisionId" defaultValue="" className="mt-1">
            <option value="">{t.organisation.noneOption}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <ProgrammeFields id={id} kinds={kinds} defaults={{ name: "", kind: defaultKind, form: "" }} />
    </NewDialog>
  );
}
