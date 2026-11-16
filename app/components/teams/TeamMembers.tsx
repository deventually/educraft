import { Form, Link } from "react-router";
import { AddDialog } from "~/components/connections/AddDialog";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Button } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export type TeamRole = "admin" | "lead" | "member";

interface Member {
  userId: string;
  name: string;
  isLead: boolean;
  email?: string | null;
}

const th = "px-4 py-2.5 font-semibold";
const badge = "ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800";
const link =
  "rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

/**
 * The members of a team on the one team page (plan step 5), with the controls of the role:
 * - **admin**: Leden toevoegen, a Teamleider tick that autosaves, Weghalen for anyone;
 * - **lead**: Leden toevoegen, Teamleider maken on a plain member, Weghalen on anyone but
 *   themselves, also another lead (Bastiaan, 2026-11-16);
 * - **member**: names and who leads, nothing to press (BESLUIT-2026-11-16-7).
 * Every Weghalen asks first.
 */
export function TeamMembers({
  role,
  team,
  selfId,
  candidates,
  errorMessage,
}: {
  role: TeamRole;
  team: { id: string; name: string; members: Member[] };
  selfId: string;
  candidates: { id: string; name: string; email: string | null }[];
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const tt = t.teams;
  const manages = role !== "member";
  return (
    <section aria-labelledby="team-members">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="team-members"
          className="font-display text-lg font-medium tracking-tight text-slate-900"
        >
          {tt.members}
        </h2>
        {manages && (
          <AddDialog
            triggerLabel={tt.addMembersHeading}
            title={fmt(tt.addMembersTitle, { team: team.name })}
            description={tt.addMembersHint}
            intent="addMembers"
            pick={{
              name: "userIds",
              options: candidates.map((c) => ({
                id: c.id,
                label: c.name,
                hint: c.email ?? undefined,
              })),
              empty: tt.noCandidates,
            }}
          />
        )}
      </div>
      {team.members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{tt.noMembers}</p>
      ) : (
        <div className="relative mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{`${tt.members} — ${team.name}`}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {tt.colName}
                </th>
                {manages && (
                  <th scope="col" className={`${th} hidden sm:table-cell`}>
                    {tt.colEmail}
                  </th>
                )}
                {role === "admin" && (
                  <th scope="col" className={th}>
                    {tt.colLead}
                  </th>
                )}
                {manages && (
                  <th scope="col" className={th}>
                    <span className="sr-only">{t.people.colActions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {team.members.map((m) => (
                <tr key={m.userId} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                    {role === "admin" ? (
                      <Link to={`/admin/users/${m.userId}`} className={link}>
                        {m.name}
                      </Link>
                    ) : (
                      m.name
                    )}
                    {m.userId === selfId && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({t.admin.invites.you})
                      </span>
                    )}
                    {role !== "admin" && m.isLead && <span className={badge}>{tt.leadBadge}</span>}
                    {/* On a phone the e-mail sits under the name instead of in a column. */}
                    {manages && (
                      <span className="block text-xs font-normal text-slate-500 sm:hidden">
                        {m.email}
                      </span>
                    )}
                  </th>
                  {manages && (
                    <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">
                      {m.email ?? "—"}
                    </td>
                  )}
                  {role === "admin" && (
                    <td className="px-4 py-2.5">
                      <AutoSaveForm
                        intent="setLead"
                        hidden={{ userId: m.userId }}
                        errorMessage={errorMessage}
                      >
                        <input
                          type="checkbox"
                          name="lead"
                          value="1"
                          defaultChecked={m.isLead}
                          aria-label={fmt(tt.leadLabel, { name: m.name })}
                          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                        />
                      </AutoSaveForm>
                    </td>
                  )}
                  {manages && (
                    <td className="px-4 py-2.5">
                      {(role === "admin" || m.userId !== selfId) && (
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                          {role === "lead" && !m.isLead && (
                            <Form method="post">
                              <input type="hidden" name="intent" value="makeLead" />
                              <input type="hidden" name="userId" value={m.userId} />
                              <Button type="submit" variant="secondary" size="sm">
                                {tt.makeLead}
                              </Button>
                            </Form>
                          )}
                          <ConfirmDialog
                            triggerLabel={t.connections.remove}
                            triggerContext={m.name}
                            triggerVariant="ghost"
                            title={fmt(tt.memberRemoveTitle, { name: m.name, team: team.name })}
                            description={tt.memberRemoveBody}
                            confirmLabel={t.connections.remove}
                            confirmVariant="primary"
                            cancelLabel={t.confirm.cancel}
                            fields={{ intent: "removeMember", userId: m.userId }}
                          />
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
