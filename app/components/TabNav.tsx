import { Link } from "react-router";
import { cn } from "~/lib/utils";

/**
 * A row of tabs as links (a course, a dossier, a learning outcome): each tab has its own URL,
 * the current one is marked with `aria-current="page"`. The tabs wrap on a narrow screen, so the
 * current one is always in sight.
 */
export function TabNav({
  label,
  tabs,
  current,
}: {
  /** The accessible name of the navigation. */
  label: string;
  tabs: { id: string; label: string; href: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-x-1 border-b border-slate-200">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              to={tab.href}
              aria-current={tab.id === current ? "page" : undefined}
              preventScrollReset
              className={cn(
                "-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-violet-500",
                tab.id === current
                  ? "border-violet-600 bg-violet-50 text-violet-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
