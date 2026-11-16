import { useId, useState } from "react";
import { Form } from "react-router";
import { Plus } from "lucide-react";
import { Modal } from "~/components/Modal";
import { Button, Label, Select } from "~/components/ui";
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
  const [open, setOpen] = useState(startOpen);
  const close = () => setOpen(false);
  const defaultKind = kinds.some((k) => k.value === "hbo:bachelor") ? "hbo:bachelor" : "";
  return (
    <>
      <Button id={triggerId} type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        {p.createTitle}
      </Button>
      {open && (
        <Modal titleId={`${id}-title`} onClose={close} className="max-w-lg">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-slate-900">
            {title ?? p.createTitle}
          </h2>
          <Form method="post" action="/programmes" onSubmit={close} className="mt-4 grid gap-4">
            <input type="hidden" name="intent" value="create" />
            {division && <input type="hidden" name="divisionId" value={division.id} />}
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
            <ProgrammeFields
              id={id}
              kinds={kinds}
              defaults={{ name: "", kind: defaultKind, form: "" }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close}>
                {t.confirm.cancel}
              </Button>
              <Button type="submit">{p.create}</Button>
            </div>
          </Form>
        </Modal>
      )}
    </>
  );
}
