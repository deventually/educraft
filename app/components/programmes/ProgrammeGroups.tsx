import { Trash2 } from "lucide-react";
import { Link } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

type Row = {
  id: string;
  name: string;
  kind: string;
  teamName: string;
  courses: number;
  canDelete: boolean;
};

/** One faculty (or none) with its programmes. */
export type ProgrammeGroup = { id: string | null; name: string | null; programmes: Row[] };

/**
 * The programmes, per faculty (plan step 4): a heading per faculty, those without one last under
 * "Zonder faculteit". When no programme has a faculty it is one plain list.
 */
export function ProgrammeGroups({
  groups,
  divisionWord,
}: {
  groups: ProgrammeGroup[];
  divisionWord?: string;
}) {
  const t = useT();
  const p = t.programmes;
  const plain = groups.every((g) => g.id === null);
  if (plain) return <Rows rows={groups.flatMap((g) => g.programmes)} />;
  return (
    <div className="mt-3 space-y-6">
      {groups.map((g) => {
        const headingId = `programme-group-${g.id ?? "none"}`;
        return (
          <section key={g.id ?? "none"} aria-labelledby={headingId}>
            <h3 id={headingId} className="font-medium text-slate-800">
              {g.name ??
                fmt(p.noDivision, { division: (divisionWord ?? p.division).toLowerCase() })}
            </h3>
            <Rows rows={g.programmes} />
          </section>
        );
      })}
    </div>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  const t = useT();
  const p = t.programmes;
  return (
    <ul className="mt-3 space-y-3">
      {rows.map((programme) => (
        <li
          key={programme.id}
          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="min-w-0">
            <Link
              to={`/programmes/${programme.id}`}
              className="font-medium text-slate-900 underline-offset-2 hover:underline"
            >
              {programme.name}
            </Link>
            <p className="text-sm text-slate-600">
              {fmt(programme.teamName ? p.summary : p.summaryNoTeam, {
                kind: programme.kind,
                team: programme.teamName,
                courses: programme.courses,
              })}
            </p>
          </div>
          {programme.canDelete && (
            <ConfirmDialog
              triggerLabel={`${p.delete}: ${programme.name}`}
              triggerIcon={<Trash2 className="size-4" aria-hidden />}
              triggerIconOnly
              title={p.deleteTitle}
              description={p.deleteBody}
              confirmLabel={p.delete}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "delete", id: programme.id }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
