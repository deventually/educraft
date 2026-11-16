import { Link } from "react-router";
import { CheckCircle2, Circle } from "lucide-react";
import type { Route } from "./+types/admin._index";
import { isOwner, requireRole } from "~/server/auth.server";
import { getDivisionKind, listDivisions } from "~/server/repositories/organisation.server";
import { listProgrammes } from "~/server/repositories/programmes.server";
import { listTeams } from "~/server/repositories/teams.server";
import { listUsers } from "~/server/repositories/users.server";
import { setupSteps } from "~/lib/admin/setup";
import { adminMenu } from "~/lib/nav/menu";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui";

/**
 * Beheer → Overzicht en inrichten (plan "eenvoudiger beheer en navigatie", step 2): where an
 * admin lands. The setup list says in which order to set up the institution, what is done
 * and where each step is done; below it, every admin page with a line on what it is for.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const [kind, divisions, programmes, teams, users] = await Promise.all([
    getDivisionKind(),
    listDivisions(),
    listProgrammes(admin, 500),
    listTeams(),
    listUsers(),
  ]);
  return {
    isOwner: await isOwner(admin),
    counts: {
      users: users.length,
      teams: teams.length,
      programmes: programmes.length,
      divisions: divisions.length,
    },
    steps: setupSteps({
      kindChosen: kind !== null,
      divisions: divisions.length,
      users: users.length,
      teams: teams.length,
      teamsWithoutMembers: teams.filter((team) => team.members.length === 0).length,
      programmes: programmes.length,
      programmesWithoutDivision: programmes.filter((p) => !p.divisionId).length,
    }),
  };
}

export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const s = t.adminSetup;
  const { steps, isOwner, counts } = loaderData;
  const numbers = [
    { key: "users", to: "/admin/users", n: counts.users },
    { key: "teams", to: "/admin/teams", n: counts.teams },
    { key: "programmes", to: "/programmes", n: counts.programmes },
    { key: "divisions", to: "/admin/organisation", n: counts.divisions },
  ] as const;
  const required = steps.filter((step) => !step.optional);
  // The overview itself is the first group; the rest is "Alles van Beheer".
  const groups = adminMenu(t, { isOwner }).filter((g) => g.heading);
  const h2 = "text-lg font-medium text-slate-900";

  return (
    <div className="space-y-8">
      <section aria-labelledby="numbers-heading">
        <h2 id="numbers-heading" className={h2}>
          {s.numbers.heading}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {numbers.map(({ key, to, n }) => {
            const words = s.numbers[key];
            return (
              <li key={key}>
                <Link
                  to={to}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm hover:border-violet-300 hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {fmt(n === 1 ? words.one : words.other, { n })}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="setup-heading">
        <h2 id="setup-heading" className={h2}>
          {s.heading}
        </h2>
        <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{s.intro}</p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {fmt(s.progress, {
            done: required.filter((step) => step.done).length,
            total: required.length,
          })}
        </p>
        <ol aria-label={s.list} className="mt-4 space-y-3">
          {steps.map((step, i) => {
            const text = s.steps[step.id];
            const status = step.done
              ? s.status.done
              : step.optional
                ? s.status.optional
                : s.status.todo;
            return (
              <li
                key={step.id}
                className={cn(
                  "flex gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm",
                  step.done ? "border-emerald-200" : "border-slate-200",
                )}
              >
                {step.done ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />
                )}
                <div className="min-w-0">
                  <h3 className="font-medium text-slate-900">
                    {i + 1}. {text.title}{" "}
                    <span
                      className={cn(
                        "ml-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        step.done
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {status}
                    </span>
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{text.body}</p>
                  <Link
                    to={step.to}
                    className="mt-1 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
                  >
                    {text.action}
                  </Link>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="all-heading">
        <h2 id="all-heading" className={h2}>
          {s.all}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.heading} className="p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                {group.heading}
              </h3>
              <ul className="mt-2 space-y-2">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="font-medium text-violet-700 underline underline-offset-2"
                    >
                      {link.label}
                    </Link>
                    <p className="text-sm text-slate-600">{link.description}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
