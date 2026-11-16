import { Form, Link, redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/teams._index";
import { requireRole, requireUser } from "~/server/auth.server";
import { createTeam, listTeams } from "~/server/repositories/teams.server";
import { listMyTeams } from "~/server/repositories/teamView.server";
import { useT } from "~/lib/i18n/useT";
import { teamError } from "~/components/teams/teamError";
import { NewDialog } from "~/components/connections/NewDialog";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";
import { HelpLink } from "~/components/HelpLink";

const SearchSchema = z.string().trim().max(100).catch("");

/**
 * Onderwijs › Teams (plan step 5, BESLUIT-2026-11-16-7): an admin sees every team, searches
 * on team or person and makes a new one; a teacher sees the teams they are in. Every row opens
 * the one team page, `/teams/:id`. Nobody sees anyone's content here.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const q = SearchSchema.parse(new URL(request.url).searchParams.get("q") ?? "");
  const needle = q.toLowerCase();
  const hit = (text: string | null) => !!text && text.toLowerCase().includes(needle);
  if (user.role === "admin") {
    await requireRole(request, "admin");
    const all = (await listTeams()).filter(
      (t) => !needle || hit(t.name) || t.members.some((m) => hit(m.name) || hit(m.email)),
    );
    return {
      q,
      canCreate: true,
      teams: all.map((t) => ({
        id: t.id,
        name: t.name,
        memberCount: t.members.length,
        leads: t.members.filter((m) => m.isLead).map((m) => m.name),
        isLead: t.members.some((m) => m.userId === user.id && m.isLead),
      })),
    };
  }
  const mine = await listMyTeams(user.id);
  return {
    q,
    canCreate: false,
    teams: mine.filter((t) => !needle || hit(t.name) || t.leads.some(hit)),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  if (fd.get("intent") !== "create") return { error: "unknown" as const };
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "nameRequired" as const };
  // A new team is empty: go straight to its page to add people.
  const team = await createTeam(name);
  return redirect(`/teams/${team.id}`);
}

const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";

export default function Teams({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const actionData = useActionData<typeof action>();
  const { q, teams, canCreate } = loaderData;

  useFormToast(actionData, {
    result: (d) =>
      d && "error" in d && d.error ? { variant: "error", message: teamError(t, d.error) } : null,
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
            {tt.heading}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {canCreate ? tt.adminIntro : tt.overviewIntro}
          </p>
          <HelpLink topic="teams" />
        </div>
        {canCreate && (
          <NewDialog
            triggerLabel={tt.newTeam}
            title={tt.newTeam}
            intent="create"
            submitLabel={tt.create}
          >
            <div>
              <Label htmlFor="team-new">{tt.createLabel}</Label>
              <Input
                id="team-new"
                name="name"
                type="text"
                required
                maxLength={100}
                className="mt-1"
                data-autofocus
              />
            </div>
          </NewDialog>
        )}
      </header>

      {/* ── Search: a plain GET form, the loader filters ─────────────────────── */}
      {(canCreate || q || teams.length > 5) && (
        <Form
          method="get"
          role="search"
          aria-label={tt.searchRegion}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-48 flex-1 sm:max-w-md">
            <Label htmlFor="teams-q">{canCreate ? tt.search : tt.searchMine}</Label>
            <Input id="teams-q" name="q" type="search" defaultValue={q} className="mt-1" />
          </div>
          <Button type="submit" variant="secondary">
            {t.people.filterSubmit}
          </Button>
        </Form>
      )}

      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">
          {q ? tt.noMatch : canCreate ? tt.noTeams : tt.noOwnTeams}
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{tt.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {tt.colName}
                </th>
                <th scope="col" className={th}>
                  {tt.colMembers}
                </th>
                <th scope="col" className={`${th} hidden sm:table-cell`}>
                  {tt.colLeads}
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    <Link
                      to={`/teams/${team.id}`}
                      className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {team.name}
                    </Link>
                    {team.isLead && (
                      <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                        {tt.leadBadge}
                      </span>
                    )}
                    {/* On a phone the leads sit under the name instead of in a column. */}
                    <span className="block text-xs font-normal text-slate-500 sm:hidden">
                      {team.leads.join(", ")}
                    </span>
                  </th>
                  <td className={td}>{team.memberCount}</td>
                  <td className={`${td} hidden sm:table-cell`}>
                    {team.leads.length ? team.leads.join(", ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
