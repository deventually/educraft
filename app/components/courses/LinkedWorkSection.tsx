import { useId } from "react";
import { Link } from "react-router";
import { Card } from "~/components/ui";
import { type LocalizedText, loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";

export interface LinkedWorkItem {
  generationId: string;
  toolName: LocalizedText | string;
  itemTitle: string | null;
  createdAt: Date | string;
}

/** "Gekoppeld werk" (P20.4): what the teacher made with the tools for this course. */
export function LinkedWorkSection({ work }: { work: LinkedWorkItem[] }) {
  const t = useT();
  const locale = useLocale();
  const m = t.courses.links;
  const id = useId();
  const dateLocale = locale === "en" ? "en-GB" : "nl-NL";
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>
      {work.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{m.empty}</p>
      ) : (
        <Card className="mt-3">
          <ul className="divide-y divide-slate-100">
            {work.map((w) => (
              <li
                key={w.generationId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {typeof w.toolName === "string" ? w.toolName : loc(w.toolName, locale)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {new Date(w.createdAt).toLocaleDateString(dateLocale, { dateStyle: "medium" })}
                    {w.itemTitle && ` · ${w.itemTitle}`}
                  </p>
                </div>
                <Link
                  to="/projects"
                  className="text-sm font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {m.openInWork}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}
