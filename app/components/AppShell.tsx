import { useState } from "react";
import { Form, NavLink, Outlet, useLocation } from "react-router";
import { Menu, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { LOCALES } from "~/lib/i18n";
import { LICENSE_URL } from "~/lib/prompts/attribution";

type NavItem = { to: string; label: string; end: boolean };

const MOBILE_NAV_ID = "mobile-nav";

export default function AppShell() {
  const t = useT();
  const locale = useLocale();
  const location = useLocation();
  const redirectTo = location.pathname + location.search;
  const [menuOpen, setMenuOpen] = useState(false);

  const nav: NavItem[] = [
    { to: "/", label: t.nav.tools, end: true },
    { to: "/projects", label: t.nav.projects, end: false },
    { to: "/help", label: t.nav.help, end: false },
    { to: "/settings", label: t.nav.settings, end: false },
    { to: "/about", label: t.nav.about, end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4">
          <NavLink
            to="/"
            onClick={() => setMenuOpen(false)}
            className="flex shrink-0 items-center"
            aria-label={t.appName}
          >
            <img src="/logo.svg" alt={t.appName} className="h-9 w-auto" />
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
            <LanguageSwitcher current={locale} redirectTo={redirectTo} />
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500">
          {t.appName} — {t.footer.prompts}{" "}
          <span className="font-medium text-slate-600">The Pedagogical Promptbook</span> (
          {t.footer.by}), {t.footer.licensed}{" "}
          <a
            href={LICENSE_URL}
            className="text-violet-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            CC BY 4.0
          </a>
          .
        </div>
      </footer>
    </div>
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
