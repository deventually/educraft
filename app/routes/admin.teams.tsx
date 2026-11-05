import { Form, useActionData } from "react-router";
import { Plus, Trash2, UserMinus } from "lucide-react";
import type { Route } from "./+types/admin.teams";
import { requireRole } from "~/server/auth.server";
import {
  addMember,
  createTeam,
  deleteTeam,
  listTeams,
  removeMember,
  renameTeam,
  setLead,
} from "~/server/repositories/teams.server";
import { getUserByEmail } from "~/server/repositories/users.server";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { teamError } from "~/components/teams/teamError";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";

/**
 * Teams (P28.2, admin): every team with its members and leads; create, rename, delete,
 * add a member by e-mail, remove one, and make or unmake a lead. The admin sees who is
 * in which team, never anyone's content.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  return { teams: await listTeams() };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const teamId = String(fd.get("teamId") ?? "");
  const name = String(fd.get("name") ?? "").trim();

  if (intent === "create") {
    if (!name) return { error: "nameRequired" as const };
    await createTeam(name);
    return { saved: true as const };
  }
  if (intent === "rename") {
    if (!name) return { error: "nameRequired" as const };
    await renameTeam(teamId, name);
    return { saved: true as const };
  }
  if (intent === "delete") {
    await deleteTeam(teamId);
    return { saved: true as const };
  }
  if (intent === "addMember") {
    const email = String(fd.get("email") ?? "").trim();
    const user = email ? await getUserByEmail(email) : null;
    if (!user) return { error: "noSuchUser" as const };
    await addMember(teamId, user.id);
    return { saved: true as const };
  }
  if (intent === "removeMember") {
    await removeMember(teamId, String(fd.get("userId") ?? ""));
    return { saved: true as const };
  }
  if (intent === "setLead") {
    await setLead(teamId, String(fd.get("userId") ?? ""), fd.get("lead") === "1");
    return { saved: true as const };
  }
  return { error: "unknown" as const };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const th = "px-4 py-2.5 font-semibold";

export default function AdminTeams({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const actionData = useActionData<typeof action>();
  const errorOf = (code: string | true) =>
    typeof code === "string" ? teamError(t, code) : undefined;

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && d.error
          ? { variant: "error", message: teamError(t, d.error) }
          : { variant: "success", message: t.admin.console.saved },
  });

  return (
    <div className="space-y-8">
      <section>
        <h2 className={h2}>{tt.heading}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{tt.adminIntro}</p>
        <Form method="post" className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="create" />
          <div className="min-w-48 flex-1">
            <Label htmlFor="team-new">{tt.createLabel}</Label>
            <Input
              id="team-new"
              name="name"
              type="text"
              required
              maxLength={100}
              className="mt-1"
            />
          </div>
          <Button type="submit">
            <Plus className="size-4" aria-hidden />
            {tt.create}
          </Button>
        </Form>
      </section>

      {loaderData.teams.length === 0 ? (
        <p className="text-sm text-slate-500">{tt.noTeams}</p>
      ) : (
        <div className="space-y-6">
          {loaderData.teams.map((team) => (
            <article
              key={team.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{team.name}</h3>
                <ConfirmDialog
                  triggerLabel={tt.delete}
                  triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
                  title={fmt(tt.deleteTitle, { name: team.name })}
                  description={tt.deleteBody}
                  confirmLabel={tt.deleteConfirm}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", teamId: team.id }}
                />
              </div>

              <AutoSaveForm
                intent="rename"
                hidden={{ teamId: team.id }}
                errorMessage={errorOf}
                className="mt-3 max-w-sm"
              >
                <Label htmlFor={`team-name-${team.id}`}>
                  {fmt(tt.renameLabel, { name: team.name })}
                </Label>
                <Input
                  id={`team-name-${team.id}`}
                  name="name"
                  type="text"
                  defaultValue={team.name}
                  maxLength={100}
                  className="mt-1"
                />
              </AutoSaveForm>

              <h4 className="mt-5 text-sm font-semibold text-slate-800">{tt.members}</h4>
              {team.members.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{tt.noMembers}</p>
              ) : (
                <div className="relative mt-2 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">{`${tt.members} — ${team.name}`}</caption>
                    <thead className="bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className={th}>
                          {tt.colName}
                        </th>
                        <th scope="col" className={th}>
                          {tt.colEmail}
                        </th>
                        <th scope="col" className={th}>
                          {tt.colLead}
                        </th>
                        <th scope="col" className={th}>
                          <span className="sr-only">{tt.remove}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.members.map((m) => (
                        <tr key={m.userId} className="border-t border-slate-50">
                          <th scope="row" className="px-4 py-2 font-medium text-slate-800">
                            {m.name}
                          </th>
                          <td className="px-4 py-2 text-slate-600">{m.email ?? "—"}</td>
                          <td className="px-4 py-2">
                            <AutoSaveForm
                              intent="setLead"
                              hidden={{ teamId: team.id, userId: m.userId }}
                              errorMessage={errorOf}
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
                          <td className="px-4 py-2 text-right">
                            <Form method="post">
                              <input type="hidden" name="intent" value="removeMember" />
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="userId" value={m.userId} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                aria-label={fmt(tt.removeLabel, { name: m.name })}
                              >
                                <UserMinus className="size-3.5" aria-hidden />
                              </Button>
                            </Form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Form method="post" className="mt-4 flex max-w-xl flex-wrap items-end gap-3">
                <input type="hidden" name="intent" value="addMember" />
                <input type="hidden" name="teamId" value={team.id} />
                <div className="min-w-48 flex-1">
                  <Label htmlFor={`team-add-${team.id}`}>{tt.addMemberLabel}</Label>
                  <Input
                    id={`team-add-${team.id}`}
                    name="email"
                    type="email"
                    required
                    className="mt-1"
                  />
                </div>
                <Button type="submit" variant="secondary">
                  {tt.add}
                </Button>
              </Form>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
