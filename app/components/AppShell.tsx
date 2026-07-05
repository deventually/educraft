import { useState } from "react";
import {
  Form,
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useRouteLoaderData,
} from "react-router";
import { ArrowUp, LogOut, Menu, UserCog, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import type { Messages } from "~/lib/i18n/messages/nl";
import { LOCALES } from "~/lib/i18n";
import { LICENSE_URL } from "~/lib/prompts/attribution";
import { SITE } from "~/lib/site";

type NavItem = { to: string; label: string; end: boolean };

const MOBILE_NAV_ID = "mobile-nav";

export default function AppShell() {
  const t = useT();
  const locale = useLocale();
  const location = useLocation();
  const root = useRouteLoaderData("root") as
    | { user?: { name: string; role: string; realRole?: string } | null }
    | undefined;
  const user = root?.user ?? null;
  const redirectTo = location.pathname + location.search;
  const [menuOpen, setMenuOpen] = useState(false);
  // A chat tool claims the full height: the page itself must not scroll and the
  // footer is hidden, so the chat's own thread scrolls and the composer pins.
  // Scoped to the tool page itself — a help page (/help/:id) for the same tool
  // also carries the tool in its loader data, but must scroll like any article.
  const matches = useMatches();
  const isChatRoute =
    location.pathname.startsWith("/tools/") &&
    matches.some(
      (m) => (m.data as { tool?: { mode?: string } } | undefined)?.tool?.mode === "chat",
    );

  const nav: NavItem[] = [
    { to: "/", label: t.nav.tools, end: true },
    { to: "/projects", label: t.nav.projects, end: false },
    // Provisioning is a teacher/admin surface only.
    ...(user && user.role !== "student"
      ? [{ to: "/cohorts", label: t.nav.cohorts, end: false }]
      : []),
    // Admin console — shown for the effective admin role (hidden while an admin
    // is viewing as a teacher).
    ...(user && user.role === "admin" ? [{ to: "/admin", label: t.nav.admin, end: false }] : []),
    { to: "/help", label: t.nav.help, end: false },
    { to: "/context-profiles", label: t.nav.settings, end: false },
    { to: "/about", label: t.nav.about, end: false },
  ];

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4">
          <NavLink
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center"
            aria-label={t.appName}
          >
            <img
              src="/logo.svg"
              alt={t.appName}
              className="h-[clamp(2.3rem,3.5vw,3.25rem)] w-auto"
            />
          </NavLink>
          <div className="flex items-center gap-2">
            {/* Inline nav — visible from md upward. */}
            <nav aria-label={t.nav.label} className="hidden items-center gap-1 md:flex">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            {/* Admins can dynamically drop into the teacher experience and back. */}
            {user?.realRole === "admin" && (
              <RoleSwitch
                viewingAsTeacher={user.role === "teacher"}
                redirectTo={redirectTo}
                toTeacherLabel={t.nav.viewAsTeacher}
                toAdminLabel={t.nav.backToAdmin}
              />
            )}
            <LanguageSwitcher current={locale} redirectTo={redirectTo} />
            {user && (
              <UserArea
                name={user.name}
                logoutLabel={t.auth.logout}
                loggedInAs={t.auth.loggedInAs}
                accountLabel={t.auth.accountArea}
              />
            )}
            {/* Hamburger — visible below md. */}
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls={MOBILE_NAV_ID}
              aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
              onClick={() => setMenuOpen((open) => !open)}
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Collapsed nav panel — only mounted while open, below md. */}
        {menuOpen && (
          <nav
            id={MOBILE_NAV_ID}
            aria-label={t.nav.menuLabel}
            className="border-t border-slate-200 bg-white px-4 py-2 md:hidden"
          >
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) => cn(navLinkClass(isActive), "block")}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      {/* Single scroll region. Normal pages scroll the document. A chat route
          still pins its composer — the chat workspace claims the remaining
          height and scrolls its own thread — but the region stays `overflow-y-auto`
          (never clipped): when the header's disclosures are expanded past the
          viewport the page itself scrolls so that content is always reachable. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <main
          id="top"
          className={cn(
            "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4",
            isChatRoute ? "min-h-0 py-6" : "py-8",
          )}
        >
          <Outlet />
        </main>

        {!isChatRoute && <SiteFooter t={t} />}
      </div>
    </div>
  );
}

function SiteFooter({ t }: { t: Messages }) {
  // A real website footer: brand + site map columns on a deep evergreen field
  // (one step darker than the brand button green). The book attribution lives in
  // the bottom bar to satisfy CC BY — the prominent link back to the book now
  // sits in each tool's "Rationale & source" panel.
  const columns = [
    {
      heading: t.footer.product,
      links: [
        { to: "/", label: t.nav.tools },
        { to: "/projects", label: t.nav.projects },
        { to: "/context-profiles", label: t.nav.settings },
      ],
    },
    {
      heading: t.footer.resources,
      links: [
        { to: "/help", label: t.nav.help },
        { to: "/about", label: t.nav.about },
        { to: "/contact", label: t.footer.contact },
      ],
    },
    {
      heading: t.footer.legal,
      links: [
        { to: "/legal", label: t.footer.disclaimer },
        { to: "/cookies", label: t.footer.cookies },
      ],
    },
  ];

  return (
    <footer className="border-t border-black/10 bg-violet-700 text-violet-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="font-display text-xl font-medium text-white">{t.appName}</span>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-violet-200">
              {t.footer.tagline}
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-violet-200">
              {t.footer.emailLabel}
            </p>
            <a
              href={`mailto:${SITE.contactEmail}`}
              className="mt-1 inline-block text-sm text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
            >
              {SITE.contactEmail}
            </a>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-200">
                {col.heading}
              </h2>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-violet-200 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {SITE.year} {t.appName}. {t.footer.rights}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <p>
              {t.footer.prompts} <span className="text-violet-100">The Pedagogical Promptbook</span>{" "}
              ({t.footer.by}), {t.footer.licensed}{" "}
              <a
                href={LICENSE_URL}
                className="text-white underline underline-offset-2 hover:no-underline"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0
              </a>
              .
            </p>
            <a
              href="#top"
              className="inline-flex shrink-0 items-center gap-1 text-violet-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
            >
              <ArrowUp className="size-3.5" aria-hidden />
              {t.footer.backToTop}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function navLinkClass(isActive: boolean) {
  return cn(
    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-violet-50 text-violet-700"
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  );
}

function UserArea({
  name,
  logoutLabel,
  loggedInAs,
  accountLabel,
}: {
  name: string;
  logoutLabel: string;
  loggedInAs: string;
  accountLabel: string;
}) {
  return (
    <div className="ml-1 flex items-center gap-1.5">
      <Link
        to="/account"
        aria-label={accountLabel}
        title={loggedInAs.replace("{name}", name)}
        className="hidden max-w-[10rem] truncate rounded-md px-1.5 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline"
      >
        {name}
      </Link>
      <Form method="post" action="/logout">
        <button
          type="submit"
          aria-label={logoutLabel}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </Form>
    </div>
  );
}

function RoleSwitch({
  viewingAsTeacher,
  redirectTo,
  toTeacherLabel,
  toAdminLabel,
}: {
  viewingAsTeacher: boolean;
  redirectTo: string;
  toTeacherLabel: string;
  toAdminLabel: string;
}) {
  // Toggle to the opposite view: from admin → teacher, or back.
  const target = viewingAsTeacher ? "admin" : "teacher";
  const label = viewingAsTeacher ? toAdminLabel : toTeacherLabel;
  return (
    <Form method="post" action="/set-view" className="hidden sm:block">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <input type="hidden" name="view" value={target} />
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
          viewingAsTeacher
            ? "border-brass-300 bg-amber-50 text-brass-700 hover:bg-amber-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        )}
      >
        <UserCog className="size-3.5" aria-hidden />
        {label}
      </button>
    </Form>
  );
}

function LanguageSwitcher({ current, redirectTo }: { current: string; redirectTo: string }) {
  return (
    <Form
      method="post"
      action="/set-locale"
      className="ml-1 flex items-center rounded-lg border border-slate-200 bg-white p-0.5"
    >
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {LOCALES.map((loc) => (
        <button
          key={loc}
          type="submit"
          name="locale"
          value={loc}
          aria-pressed={current === loc}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors",
            current === loc ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-100",
          )}
        >
          {loc}
        </button>
      ))}
    </Form>
  );
}
