import type { Route } from "./+types/projects._index";
import { listGenerations } from "~/server/repositories/generations.server";
import { getToolBySlug } from "~/lib/registry";
import { ResultPanel } from "~/components/ResultPanel";
import { Badge } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";

export function loader() {
  const generations = listGenerations(50).map((g) => ({
    id: g.id,
    toolSlug: g.toolSlug,
    toolName: getToolBySlug(g.toolSlug)?.nameNl ?? g.toolSlug,
    stageId: g.stageId,
    model: g.model,
    outputLanguage: g.outputLanguage,
    outputMarkdown: g.outputMarkdown,
    createdAt: g.createdAt,
  }));
  return { generations };
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { generations } = loaderData;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.nav.projects}</h1>
      <p className="mt-2 text-slate-600">{t.projects.subtitle}</p>

      {generations.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.projects.empty}</p>
      ) : (
        <div className="mt-6 space-y-3">
          {generations.map((g) => (
            <details key={g.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{g.toolName}</span>
                    {g.stageId && <Badge>{g.stageId}</Badge>}
                  </div>
                  <p className="truncate text-xs text-slate-400">
                    {fmtDate(g.createdAt, locale)} · {g.model} · {g.outputLanguage.toUpperCase()}
                  </p>
                </div>
              </summary>
              <div className="border-t border-slate-100 p-3">
                <ResultPanel
                  markdown={g.outputMarkdown}
                  title={g.toolName}
                  filenameBase={`${g.toolSlug}-${g.id.slice(0, 8)}`}
                />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
}
