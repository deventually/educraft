import { Form, NavLink, Outlet, useLocation } from "react-router";
import { GraduationCap } from "lucide-react";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { LOCALES } from "~/lib/i18n";
import { LICENSE_URL } from "~/lib/prompts/attribution";

export default function AppShell() {
  const t = useT();
  const locale = useLocale();
  const location = useLocation();
  const redirectTo = location.pathname + location.search;

  const nav = [
    { to: "/", label: t.nav.tools, end: true },
    { to: "/projects", label: t.nav.projects, end: false },
    { to: "/settings", label: t.nav.settings, end: false },
    { to: "/about", label: t.nav.about, end: false },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-700 via-violet-600 to-violet-500 text-white shadow-sm">
              <GraduationCap className="size-5" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              Edu<span className="font-bold text-violet-600">Craft</span>
            </span>
          </NavLink>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              {nav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <LanguageSwitcher current={locale} redirectTo={redirectTo} />
          </div>
        </div>
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
