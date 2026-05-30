import { Form, useNavigation } from "react-router";
import { Trash2 } from "lucide-react";
import type { Route } from "./+types/projects._index";
import { listGenerations, deleteGeneration } from "~/server/repositories/generations.server";
import { getToolBySlug } from "~/lib/registry";
import { ResultPanel } from "~/components/ResultPanel";
import { Badge, Button } from "~/components/ui";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

export async function action({ request }: Route.ActionArgs) {
  const fd = await request.formData();
  if (fd.get("intent") === "delete") {
    deleteGeneration(String(fd.get("id")));
    return { ok: true };
  }
  return { ok: false };
}

export function loader() {
  const generations = listGenerations(50).map((g) => ({
    id: g.id,
    toolSlug: g.toolSlug,
    toolName: getToolBySlug(g.toolSlug)?.name ?? g.toolSlug,
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
  const nav = useNavigation();
  const busy = nav.state !== "idle";
  const { generations } = loaderData;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.nav.projects}
      </h1>
      <p className="mt-2 text-slate-600">{t.projects.subtitle}</p>

      {generations.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t.projects.empty}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {generations.map((g) => (
            <li
              key={g.id}
              className="relative rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <details>
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 pr-14">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{loc(g.toolName, locale)}</span>
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
                    title={loc(g.toolName, locale)}
                    filenameBase={`${g.toolSlug}-${g.id.slice(0, 8)}`}
                  />
                </div>
              </details>
              <Form method="post" className="absolute right-3 top-2.5">
                <input type="hidden" name="id" value={g.id} />
                <Button
                  type="submit"
                  name="intent"
                  value="delete"
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  aria-label={t.projects.delete}
                >
                  <Trash2 className="size-4" />
                </Button>
              </Form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleString(intlLocale, { dateStyle: "medium", timeStyle: "short" });
}
