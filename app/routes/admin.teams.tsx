import { useState } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
import { z } from "zod";
import { Plus } from "lucide-react";
import type { Route } from "./+types/admin.teams";
import { requireRole } from "~/server/auth.server";
import { createTeam, listTeams } from "~/server/repositories/teams.server";
import { useT } from "~/lib/i18n/useT";
import { teamError } from "~/components/teams/teamError";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label } from "~/components/ui";

const SearchSchema = z.string().trim().max(100).catch("");

/**
 * The team list (P28.2, shaped like the user list of P28.1): one row per team with its
 * member count and leads, a search on team or person, and one "New team" button.
 * Everything about one team lives on its own page (`/admin/teams/:id`). The admin sees
 * who is in which team, never anyone's content.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const q = SearchSchema.parse(new URL(request.url).searchParams.get("q") ?? "");
  const needle = q.toLowerCase();
  const hit = (text: string | null) => !!text && text.toLowerCase().includes(needle);
  const teams = (await listTeams()).filter(
    (team) => !needle || hit(team.name) || team.members.some((m) => hit(m.name) || hit(m.email)),
  );
  return {
    q,
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
      leads: team.members.filter((m) => m.isLead).map((m) => m.name),
    })),
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
  return redirect(`/admin/teams/${team.id}`);
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";

export default function AdminTeams({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const tt = t.teams;
  const actionData = useActionData<typeof action>();
  const [adding, setAdding] = useState(false);
  const { q, teams } = loaderData;

  useFormToast(actionData, {
    result: (d) =>
      d && "error" in d && d.error ? { variant: "error", message: teamError(t, d.error) } : null,
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={h2}>{tt.heading}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{tt.adminIntro}</p>
          </div>
          <Button
            type="button"
            aria-expanded={adding}
            aria-controls="new-team"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-4" aria-hidden />
            {tt.newTeam}
          </Button>
        </div>

        {adding && (
          <Form
            id="new-team"
            method="post"
            className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <input type="hidden" name="intent" value="create" />
            <div className="min-w-48 flex-1 sm:max-w-sm">
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
            <Button type="submit">{tt.create}</Button>
          </Form>
        )}
      </section>

      {/* ── Search: a plain GET form, the loader filters ─────────────────────── */}
      <Form
        method="get"
        role="search"
        aria-label={tt.searchRegion}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="min-w-48 flex-1 sm:max-w-md">
          <Label htmlFor="teams-q">{tt.search}</Label>
          <Input id="teams-q" name="q" type="search" defaultValue={q} className="mt-1" />
        </div>
        <Button type="submit" variant="secondary">
          {t.people.filterSubmit}
        </Button>
      </Form>

      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">{q ? tt.noMatch : tt.noTeams}</p>
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
                <th scope="col" className={th}>
                  {tt.colLeads}
                </th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b border-slate-50 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-left font-medium">
                    <Link
                      to={`/admin/teams/${team.id}`}
                      className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {team.name}
                    </Link>
                  </th>
                  <td className={td}>{team.memberCount}</td>
                  <td className={td}>{team.leads.length ? team.leads.join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
