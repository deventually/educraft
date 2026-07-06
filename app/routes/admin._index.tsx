import { Link } from "react-router";
import {
  ArrowRight,
  Activity,
  Cpu,
  GraduationCap,
  MessagesSquare,
  SlidersHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import type { Route } from "./+types/admin._index";
import { requireRole } from "~/server/auth.server";
import { getAvailableTools } from "~/server/availability.server";
import { listUsers } from "~/server/repositories/users.server";
import { listAllCohorts } from "~/server/repositories/cohorts.server";
import { useT } from "~/lib/i18n/useT";
import { Card } from "~/components/ui";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "admin");
  const [users, cohorts, available] = await Promise.all([
    listUsers(),
    listAllCohorts(),
    getAvailableTools(user),
  ]);
  return {
    stats: {
      users: users.length,
      teachers: users.filter((u) => u.role === "teacher").length,
      students: users.filter((u) => u.role === "student").length,
      admins: users.filter((u) => u.role === "admin").length,
      cohorts: cohorts.length,
      availableTools: available.length,
    },
  };
}

export default function AdminOverview({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const { stats } = loaderData;
  const nav = t.admin.console.nav;
  const desc = t.admin.overview.desc;

  const statCards = [
    { label: t.admin.overview.stats.users, value: stats.users },
    { label: t.admin.overview.stats.teachers, value: stats.teachers },
    { label: t.admin.overview.stats.students, value: stats.students },
    { label: t.admin.overview.stats.admins, value: stats.admins },
    { label: t.admin.overview.stats.cohorts, value: stats.cohorts },
    { label: t.admin.overview.stats.availableTools, value: stats.availableTools },
  ];

  const sections = [
    { to: "/admin/tools", title: nav.tools, desc: desc.tools, Icon: SlidersHorizontal },
    { to: "/admin/models", title: nav.models, desc: desc.models, Icon: Cpu },
    { to: "/admin/context", title: nav.context, desc: desc.context, Icon: GraduationCap },
    { to: "/admin/invites", title: nav.invites, desc: desc.invites, Icon: UserPlus },
    { to: "/admin/cohorts", title: nav.cohorts, desc: desc.cohorts, Icon: Users },
    { to: "/admin/usage", title: nav.usage, desc: desc.usage, Icon: Activity },
    { to: "/admin/feedback", title: nav.feedback, desc: desc.feedback, Icon: MessagesSquare },
  ];

  return (
    <div>
      <h2 className="sr-only">{t.admin.overview.heading}</h2>
      <p className="text-sm text-slate-600">{t.admin.overview.intro}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-medium text-slate-900">{s.value}</dd>
          </Card>
        ))}
      </dl>

      <ul className="mt-6 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ to, title, desc: d, Icon }) => (
          <li key={to} className="contents">
            <Card className="p-0">
              <Link
                to={to}
                className="group flex h-full items-start gap-3.5 rounded-2xl p-5 transition-colors hover:bg-slate-50"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-slate-900">
                    {title}
                    <ArrowRight
                      className="size-4 text-violet-500 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-600">{d}</span>
                </span>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
