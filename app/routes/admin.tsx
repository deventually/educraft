import { NavLink, Outlet } from "react-router";
import type { Route } from "./+types/admin";
import { isOwner, requireRole } from "~/server/auth.server";
import { adminHealth } from "~/server/health.server";
import { HealthPanel } from "~/components/admin/HealthPanel";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";
import { cn } from "~/lib/utils";
import { HelpLink } from "~/components/HelpLink";
import { adminMenu } from "~/lib/nav/menu";

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

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const groups = adminMenu(t, { isOwner: loaderData.isOwner });

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
        {/* Persistent section nav, in the groups of the Beheer menu (`~/lib/nav/menu`): a sidebar
            with headings on md+, one horizontal scroller below. */}
        <nav
          aria-label={t.admin.console.sectionNav}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-col md:gap-4 md:overflow-visible md:px-0 md:pb-0"
        >
          {groups.map((group, i) => {
            const headingId = `admin-section-${i}`;
            return (
              <div key={headingId} className="flex shrink-0 md:block">
                {group.heading && (
                  <p
                    id={headingId}
                    className="hidden px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 md:block"
                  >
                    {group.heading}
                  </p>
                )}
                <ul
                  aria-labelledby={group.heading ? headingId : undefined}
                  className="flex gap-1 md:flex-col"
                >
                  {group.links.map((link) => (
                    <li key={link.to} className="shrink-0">
                      <NavLink
                        to={link.to}
                        end={link.end}
                        className={({ isActive }) =>
                          cn(
                            "inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors md:flex",
                            isActive
                              ? "bg-violet-50 text-violet-700"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                          )
                        }
                      >
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="min-w-0">
          <HealthPanel health={loaderData.health} />
          <Outlet />
        </div>
      </div>
    </div>
  );
}
