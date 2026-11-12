import { useId } from "react";
import { Form } from "react-router";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { Button, Input, Label, Select } from "~/components/ui";

interface ProgrammeRow {
  id: string;
  name: string;
  kindLabel: string;
  teamName: string;
  divisionId: string | null;
}

/**
 * One division on Beheer → Organisatie: its name (rename; delete while empty) and the
 * programmes under it, each with a choice where it belongs. Without `division` it is the group
 * of programmes under none.
 */
export function DivisionSection({
  division,
  heading,
  programmes,
  options,
}: {
  division?: { id: string; name: string; programmeCount: number };
  heading?: string;
  programmes: ProgrammeRow[];
  options: { id: string; name: string }[];
}) {
  const o = useT().organisation;
  const headingId = useId();
  const title = division?.name ?? heading ?? "";
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 id={headingId} className="font-display text-base font-medium text-slate-900">
        {title}
      </h3>

      {division && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <Form method="post" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="intent" value="rename" />
            <input type="hidden" name="id" value={division.id} />
            <div className="min-w-48">
              <Label htmlFor={`${headingId}-name`}>{fmt(o.rename, { name: division.name })}</Label>
              <Input
                id={`${headingId}-name`}
                name="name"
                required
                maxLength={200}
                defaultValue={division.name}
                className="mt-1"
              />
            </div>
            <Button type="submit" variant="secondary">
              {o.renameSave}
            </Button>
          </Form>
          {division.programmeCount === 0 && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={division.id} />
              <Button
                type="submit"
                variant="secondary"
                aria-label={fmt(o.delete, { name: division.name })}
              >
                {o.deleteShort}
              </Button>
            </Form>
          )}
        </div>
      )}

      {programmes.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{o.emptyDivision}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {programmes.map((p) => (
            <li key={p.id} className="flex flex-wrap items-end justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-slate-900">{p.name}</p>
                <p className="text-sm text-slate-600">
                  {p.kindLabel} · {fmt(o.team, { team: p.teamName })}
                </p>
              </div>
              <Form method="post" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="intent" value="move" />
                <input type="hidden" name="programmeId" value={p.id} />
                <div>
                  <Label htmlFor={`move-${p.id}`}>
                    {fmt(o.belongsTo, { name: `${p.name} (${p.kindLabel})` })}
                  </Label>
                  <Select
                    id={`move-${p.id}`}
                    name="divisionId"
                    defaultValue={p.divisionId ?? ""}
                    className="mt-1"
                  >
                    <option value="">{o.noneOption}</option>
                    {options.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  {o.move}
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
