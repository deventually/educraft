import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

/** One step: a link back, or the page you are on (no `to`). */
export type Crumb = { label: string; to?: string };

/**
 * The path to a deep page (plan step 4), such as Opleidingen › HBO-ICT › Programmeren, so going
 * back is always one click. The last step is the current page.
 */
export function Breadcrumb({ label, items }: { label: string; items: Crumb[] }) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
        {items.map((item, i) => (
          <li key={`${i}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />}
            {item.to ? (
              <Link
                to={item.to}
                className="rounded underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-slate-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
