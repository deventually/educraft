import { useState } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { ArrowLeft, Trash2, UserMinus, UserPlus } from "lucide-react";
import type { Route } from "./+types/admin.teams.$id";
import { requireRole } from "~/server/auth.server";
import {
  addMember,
  deleteTeam,
  getTeamWithMembers,
  removeMember,
  renameTeam,
  setLead,
  setTeamSettings,
} from "~/server/repositories/teams.server";
import { getUserById, listPeople } from "~/server/repositories/users.server";
import { applyTeamSettingsForm, getTeamSettingsOffer } from "~/server/teamSettings.server";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { teamError } from "~/components/teams/teamError";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { TeamSettingsForm } from "~/components/features/TeamSettingsForm";

/** The most people one "add" may carry; the candidate list is capped the same. */
const MAX_PEOPLE = 500;

/**
 * One team's page (admin): name, members and leads, add several colleagues at once by
 * ticking them, remove one, the team's choices (P28.3) and delete. The team is the one
 * in the URL; a `teamId` in a form is ignored.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const team = await getTeamWithMembers(params.id);
  if (!team) throw new Response("Not found", { status: 404 });
  const [people, offer] = await Promise.all([
    listPeople({ status: "active", limit: MAX_PEOPLE }),
    getTeamSettingsOffer(),
  ]);
  const inTeam = new Set(team.members.map((m) => m.userId));
  const candidates = people
    .filter((p) => p.kind === "user" && !inTeam.has(p.id))
    .map((p) => ({ id: p.id, name: p.name ?? p.email ?? p.id, email: p.email }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { team, candidates, offer };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const team = await getTeamWithMembers(params.id);
  if (!team) throw new Response("Not found", { status: 404 });
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = String(fd.get("userId") ?? "");

  if (intent === "rename") {
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return { error: "nameRequired" as const };
    await renameTeam(team.id, name);
    return { saved: true as const };
  }
  if (intent === "addMembers") {
    const ids = [...new Set(fd.getAll("userIds").map(String))].slice(0, MAX_PEOPLE);
    if (ids.length === 0) return { error: "noneSelected" as const };
    for (const id of ids) {
      // Only existing accounts; an unknown id is skipped.
      if (await getUserById(id)) await addMember(team.id, id);
    }
    return { saved: true as const };
  }
  if (intent === "removeMember") {
    await removeMember(team.id, userId);
    return { saved: true as const };
  }
  if (intent === "setLead") {
    await setLead(team.id, userId, fd.get("lead") === "1");
    return { saved: true as const };
  }
  if (intent === "settings") {
    const next = applyTeamSettingsForm(team.settings, fd, await getTeamSettingsOffer());
    if ("error" in next) return next;
    await setTeamSettings(team.id, next);
    return { saved: true as const };
  }
  if (intent === "delete") {
    await deleteTeam(team.id);
    return redirect("/admin/teams");
  }
  return { error: "unknown" as const };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const h3 = "text-sm font-semibold text-slate-800";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const th = "px-4 py-2.5 font-semibold";

/** Tick colleagues and add them in one go; the search box only narrows what is shown. */
function AddMembers({
  candidates,
}: {
  candidates: { id: string; name: string; email: string | null }[];
}) {
  const t = useT();
  const tt = t.teams;
  const [find, setFind] = useState("");
  if (candidates.length === 0) return <p className="text-sm text-slate-500">{tt.noCandidates}</p>;
  const needle = find.trim().toLowerCase();
  const shows = (c: { name: string; email: string | null }) =>
    !needle || `${c.name} ${c.email ?? ""}`.toLowerCase().includes(needle);

  return (
    <Form method="post">
      <input type="hidden" name="intent" value="addMembers" />
      <fieldset className="space-y-3">
        <legend className={h3}>{tt.addMembersHeading}</legend>
        <p className="text-xs text-slate-500">{tt.addMembersHint}</p>
        <div className="max-w-sm">
          <Label htmlFor="candidate-find">{tt.findCandidate}</Label>
          <Input
            id="candidate-find"
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            // Enter narrows the list; it never submits the form.
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            className="mt-1"
          />
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
          {candidates.map((c) => (
            // `hidden`, not removed: a ticked colleague stays ticked while you search on.
            <li key={c.id} hidden={!shows(c)}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="userIds"
                  value={c.id}
                  className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                />
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.email && <span className="text-slate-500">{c.email}</span>}
              </label>
            </li>
          ))}
        </ul>
        <Button type="submit" variant="secondary">
          <UserPlus className="size-4" aria-hidden />
          {tt.addSelected}
        </Button>
      </fieldset>
    </Form>
  );
}

export default function AdminTeam({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const { team, candidates, offer } = loaderData;
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
    <div className="space-y-6">
      <Link
        to="/admin/teams"
        className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tt.allTeams}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className={h2}>{team.name}</h2>
        <ConfirmDialog
          triggerLabel={tt.delete}
          triggerIcon={<Trash2 className="size-3.5" aria-hidden />}
          title={fmt(tt.deleteTitle, { name: team.name })}
          description={tt.deleteBody}
          confirmLabel={tt.deleteConfirm}
          cancelLabel={t.confirm.cancel}
          fields={{ intent: "delete" }}
        />
      </div>

      <section className={card}>
        <AutoSaveForm intent="rename" errorMessage={errorOf} className="max-w-sm">
          <Label htmlFor="team-name">{tt.nameLabel}</Label>
          <Input
            id="team-name"
            name="name"
            type="text"
            defaultValue={team.name}
            maxLength={100}
            className="mt-1"
          />
        </AutoSaveForm>
      </section>

      <section className={`${card} space-y-5`} aria-labelledby="team-members">
        <h3 id="team-members" className={h3}>
          {tt.members}
        </h3>
        {team.members.length === 0 ? (
          <p className="text-sm text-slate-500">{tt.noMembers}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-xl border border-slate-100">
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
                    <th scope="row" className="px-4 py-2 font-medium">
                      <Link
                        to={`/admin/users/${m.userId}`}
                        className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        {m.name}
                      </Link>
                    </th>
                    <td className="px-4 py-2 text-slate-600">{m.email ?? "—"}</td>
                    <td className="px-4 py-2">
                      <AutoSaveForm
                        intent="setLead"
                        hidden={{ userId: m.userId }}
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
        <AddMembers candidates={candidates} />
      </section>

      <section className={card} aria-labelledby="team-features">
        <h3 id="team-features" className={h3}>
          {t.features.teamFeaturesHeading}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{t.features.teamFeaturesIntro}</p>
        <div className="mt-3">
          <TeamSettingsForm
            idPrefix={`team-${team.id}`}
            settings={team.settings}
            offer={offer}
            errorMessage={errorOf}
          />
        </div>
      </section>
    </div>
  );
}
