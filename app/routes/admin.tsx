import { NavLink, Outlet } from "react-router";
import {
  Activity,
  BotMessageSquare,
  Bug,
  GraduationCap,
  ScrollText,
  SlidersHorizontal,
  Users,
  UsersRound,
} from "lucide-react";
import type { Route } from "./+types/admin";
import { isOwner, requireRole } from "~/server/auth.server";
import { adminHealth } from "~/server/health.server";
import { HealthPanel } from "~/components/admin/HealthPanel";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";
import { HelpLink } from "~/components/HelpLink";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.admin.console.title} — ${m.appName}` }];
}

/**
 * Admin console layout (Phase 4). Gates the whole section on `requireRole("admin")`
 * — and every child loader/action repeats the check, because loaders run in
 * parallel and a nested loader must not trust the layout ran first. It also carries the
 * health overview (P1), so a stale backup shows on whichever admin page is open, and
 * whether the viewer is the owner (only the owner sees "Recente fouten").
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  return { health: adminHealth(), isOwner: await isOwner(admin) };
}

const SECTIONS = [
  { to: "/admin/users", key: "users", Icon: Users },
  { to: "/admin/teams", key: "teams", Icon: UsersRound },
  { to: "/admin/tools", key: "tools", Icon: SlidersHorizontal },
  { to: "/admin/agents", key: "agents", Icon: BotMessageSquare },
  { to: "/admin/context", key: "context", Icon: GraduationCap },
  { to: "/admin/usage", key: "usage", Icon: Activity },
  { to: "/admin/audit", key: "audit", Icon: ScrollText },
] as const;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const nav = t.admin.console.nav;

  return (
    <div className="w-full min-w-0">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
          {t.admin.console.title}
        </h1>
        <p className="mt-1 text-sm text-slate-600">{t.admin.console.subtitle}</p>
        <HelpLink topic="admin" />
      </header>

      <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
        {/* Persistent section nav — a sidebar on md+, a horizontal scroller below. */}
        <nav
          aria-label={t.admin.console.sectionNav}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0"
        >
          {[
            ...SECTIONS.map((s) => ({ to: s.to, label: nav[s.key], Icon: s.Icon })),
            ...(loaderData.isOwner
              ? [{ to: "/admin/errors", label: t.adminErrors.nav, Icon: Bug }]
              : []),
          ].map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          <HealthPanel health={loaderData.health} />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
