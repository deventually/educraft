import { Link } from "react-router";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { CopyButton } from "~/components/admin/LinkCard";
import {
  LastActive,
  OwnerBadge,
  type PersonStatus,
  StatusBadge,
  roleLabel,
} from "~/components/admin/people";

/** One row of the user list: an account or an open invite (P28.1). */
export type PersonRow = {
  kind: "user" | "invite";
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: PersonStatus;
  lastActiveDay: string | null;
  link?: string;
};

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";
const tick =
  "size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * The people table. With `selection`, each account gets a tick box that joins the
 * "With selected" form (`form="bulk-form"`); without it, there are no tick boxes.
 */
export function PeopleTable({
  people,
  selfId,
  ownerId,
  selection,
}: {
  people: PersonRow[];
  selfId: string;
  ownerId: string | null;
  selection?: {
    selected: Set<string>;
    allTicked: boolean;
    toggle: (id: string) => void;
    toggleAll: () => void;
  };
}) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  return (
    // `relative`: the box is the containing block of the absolutely positioned sr-only
    // labels, so they scroll with the table instead of widening the page.
    <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{p.heading}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {selection && (
              <th scope="col" className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selection.allTicked}
                  onChange={selection.toggleAll}
                  aria-label={p.selectAll}
                  className={tick}
                />
              </th>
            )}
            <th scope="col" className={th}>
              {p.colName}
            </th>
            <th scope="col" className={th}>
              {p.colEmail}
            </th>
            <th scope="col" className={th}>
              {p.colRole}
            </th>
            <th scope="col" className={th}>
              {p.colStatus}
            </th>
            <th scope="col" className={th}>
              {p.colLastActive}
            </th>
            <th scope="col" className={`${th} text-right`}>
              <span className="sr-only">{p.colActions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr
              key={`${person.kind}-${person.id}`}
              className="border-b border-slate-50 align-top last:border-0"
            >
              {selection && (
                <td className="px-4 py-2.5">
                  {person.kind === "user" && (
                    <input
                      type="checkbox"
                      form="bulk-form"
                      name="userIds"
                      value={person.id}
                      checked={selection.selected.has(person.id)}
                      onChange={() => selection.toggle(person.id)}
                      aria-label={fmt(p.selectPerson, {
                        name: person.name || person.email || person.id,
                      })}
                      className={tick}
                    />
                  )}
                </td>
              )}
              <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                {person.kind === "user" ? (
                  <Link
                    to={`/admin/users/${person.id}`}
                    className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    {person.name || person.email || person.id}
                  </Link>
                ) : (
                  (person.name ?? i.linkOnly)
                )}
                {person.id === selfId && (
                  <span className="ml-1.5 text-xs font-normal text-slate-500">({i.you})</span>
                )}
                {person.kind === "user" && person.id === ownerId && <OwnerBadge />}
              </th>
              <td className={td}>{person.email ?? "—"}</td>
              <td className={td}>{roleLabel(t, person.role)}</td>
              <td className={td}>
                <StatusBadge status={person.status} />
              </td>
              <td className={td}>
                {person.kind === "user" ? <LastActive day={person.lastActiveDay} /> : "—"}
              </td>
              <td className="px-4 py-2.5">
                {person.kind === "invite" && person.link && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <CopyButton url={person.link} label={p.copyLink} />
                    <ConfirmDialog
                      triggerLabel={i.revoke}
                      title={i.revokeTitle}
                      description={i.revokeBody}
                      confirmLabel={i.revoke}
                      cancelLabel={t.confirm.cancel}
                      fields={{ intent: "revoke", token: person.id }}
                    />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
