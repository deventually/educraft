import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches, useRouteLoaderData } from "react-router";
import { CircleHelp, Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { modeOf } from "~/lib/registry/modes";
import type { Tool } from "~/lib/registry/types";
import type { ShownAnnouncement } from "~/lib/announcements";
import { AnnouncementBanner } from "./shell/AnnouncementBanner";
import { LanguageSwitcher } from "./shell/LanguageSwitcher";
import { type NavItem, navLinkClass } from "./shell/nav";
import { RouteAnnouncer } from "./shell/RouteAnnouncer";
import { SiteFooter } from "./shell/SiteFooter";
import { UserArea } from "./shell/UserArea";
import { useDisclosure } from "./shell/useDisclosure";

const MOBILE_NAV_ID = "mobile-nav";

export default function AppShell() {
  const t = useT();
  const locale = useLocale();
  const location = useLocation();
  const root = useRouteLoaderData("root") as
    | {
        user?: {
          name: string;
          role: string;
          portfolio?: boolean;
          features?: Partial<Record<string, boolean>>;
        } | null;
        announcements?: ShownAnnouncement[];
      }
    | undefined;
  const user = root?.user ?? null;
  // BDB/BKE shows only when an admin switched the workplace on for this user (P27).
  const portfolio = user?.portfolio === true;
  // Courses can be switched off per team (P28.3); unknown (signed out) = shown.
  const courses = user?.features?.courses !== false;
  const redirectTo = location.pathname + location.search;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const mobileMenu = useDisclosure({
    open: menuOpen,
    close: closeMenu,
    button: menuButton,
    panel: menuPanel,
  });

  // Focus-to-main on client navigation: keyboard/SR users restart at the top of
  // the new page. Skips the initial mount so we never yank focus on first paint.
  // (The RouteAnnouncer below reads the new title politely — focusing the <main>
  // landmark doesn't read it, so the two don't collide.)
  const mainRef = useRef<HTMLElement>(null);
  const firstRenderRef = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every navigation to move focus
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [location.pathname]);
  // A chat tool claims the full height: the page itself must not scroll and the
  // footer is hidden, so the chat's own thread scrolls and the composer pins.
  // Scoped to the tool page itself — a help page (/help/:id) for the same tool
  // also carries the tool in its loader data, but must scroll like any article.
  const matches = useMatches();
  const fillsHeight =
    location.pathname.startsWith("/tools/") &&
    matches.some((m) => {
      const tool = (m.loaderData as { tool?: Tool } | undefined)?.tool;
      return tool ? modeOf(tool).fillsHeight : false;
    });

  // The menu of four (P27.3): Start · Cursussen · BDB/BKE · Tools, plus Beheer for an admin.
  // "Eerder gemaakt" lives on Start and Tools, Onderwijscontext in the account menu, Help is the
  // question mark at the top right; all of them stay in the footer.
  const nav: NavItem[] = [
    // Admin console — first for an admin, so they land on their console entry immediately.
    ...(user && user.role === "admin" ? [{ to: "/admin", label: t.nav.admin, end: false }] : []),
    { to: "/start", label: t.nav.start, end: true },
    ...(courses ? [{ to: "/courses", label: t.nav.courses, end: false }] : []),
    ...(portfolio ? [{ to: "/portfolio", label: t.nav.portfolio, end: false }] : []),
    { to: "/tools", label: t.nav.tools, end: false },
  ];
  const accountLinks: NavItem[] = [
    { to: "/account", label: t.auth.accountArea, end: true },
    { to: "/context-profiles", label: t.nav.settings, end: false },
    { to: "/assessment-models", label: t.nav.assessmentModels, end: false },
    { to: "/usage", label: t.nav.usage, end: true },
  ];

  return (
    <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
      {/* First focusable element — a keyboard user can jump straight to content. */}
      <a
        href="#top"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
      >
        {t.nav.skipToContent}
      </a>
      <RouteAnnouncer />

      <header className="z-10 border-b border-slate-200 bg-white/80 backdrop-blur print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4">
          <NavLink
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center"
            aria-label={t.appName}
          >
            <img src="/logo.svg" alt={t.appName} className="h-[clamp(2rem,3.5vw,3.25rem)] w-auto" />
          </NavLink>
          <div className="flex items-center gap-1 sm:gap-2">
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
            <LanguageSwitcher current={locale} redirectTo={redirectTo} />
            <Link
              to="/help"
              aria-label={t.nav.help}
              title={t.nav.help}
              className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <CircleHelp className="size-5" aria-hidden />
            </Link>
            {user && (
              <UserArea
                name={user.name}
                links={accountLinks}
                logoutLabel={t.auth.logout}
                loggedInAs={t.auth.loggedInAs}
                accountLabel={t.auth.accountArea}
              />
            )}
            {/* Hamburger — visible below md. */}
            <button
              ref={menuButton}
              type="button"
              onKeyDown={mobileMenu.onKeyDown}
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
            ref={menuPanel}
            id={MOBILE_NAV_ID}
            onKeyDown={mobileMenu.onKeyDown}
            aria-label={t.nav.menuLabel}
            className="border-t border-slate-200 bg-white px-4 py-2 md:hidden"
          >
            {[nav, ...(user ? [accountLinks] : [])].map((items, i) => (
              <ul
                key={items[0]?.to}
                className={cn(
                  "flex flex-col gap-1",
                  i > 0 && "mt-2 border-t border-slate-200 pt-2",
                )}
              >
                {items.map((item) => (
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
            ))}
          </nav>
        )}
      </header>

      {/* Single scroll region. Normal pages scroll the document. A chat route
          still pins its composer — the chat workspace claims the remaining
          height and scrolls its own thread — but the region stays `overflow-y-auto`
          (never clipped): when the header's disclosures are expanded past the
          viewport the page itself scrolls so that content is always reachable. */}
      {/* `relative`: hidden screen-reader text (sr-only, absolutely positioned) anchors
          here instead of against the viewport, so it never makes a page scroll past its footer. */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        <AnnouncementBanner announcements={root?.announcements ?? []} t={t.announcements.banner} />
        <main
          id="top"
          ref={mainRef}
          tabIndex={-1}
          className={cn(
            "mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 focus:outline-none",
            fillsHeight ? "min-h-0 py-6" : "py-8",
          )}
        >
          <Outlet />
        </main>

        {!fillsHeight && <SiteFooter t={t} portfolio={portfolio} courses={courses} />}
      </div>
    </div>
  );
}
