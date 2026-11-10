import { Form, useActionData } from "react-router";
import { FolderOpen, Trash2 } from "lucide-react";
import type { Route } from "./+types/projects._index";
import { listGenerations, deleteGeneration } from "~/server/repositories/generations.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { requireUser } from "~/server/auth.server";
import { listDossiers } from "~/server/repositories/portfolio.server";
import { addGenerationToDossier } from "~/server/evidence.server";
import { portfolioAccess } from "~/server/portfolioAccess.server";
import { courseLinkIntent, loadCourseLinks } from "~/server/courses.server";
import { CourseLinkBadges, CourseLinkForm } from "~/components/courses/CourseLinks";
import { getToolBySlug } from "~/lib/registry";
import { ResultPanel } from "~/components/ResultPanel";
import { ExportMenu } from "~/components/export/ExportMenu";
import { FeedbackWidget } from "~/components/FeedbackWidget";
import { Badge, Button, Label, Select } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { HelpLink } from "~/components/HelpLink";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  const linked = await courseLinkIntent(request, user.id, fd);
  if (linked) return linked;
  if (fd.get("intent") === "delete") {
    await deleteGeneration(user.id, String(fd.get("id")));
    return { ok: true, intent: "delete" };
  }
  if (fd.get("intent") === "addToDossier") {
    // "Voeg toe aan dossier" (P25, 25.3): the output becomes unlinked evidence;
    // the teacher links it to criteria on the outcome page.
    const added = await addGenerationToDossier(
      user,
      { generationId: String(fd.get("id") ?? ""), dossierId: String(fd.get("dossierId") ?? "") },
      getLocale(request),
    );
    return added.ok ? { ok: true, intent: "addToDossier" } : added;
  }
  return { ok: false };
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const links = await loadCourseLinks(user.id);
  const generations = (await listGenerations(user.id, 50)).map((g) => ({
    id: g.id,
    toolSlug: g.toolSlug,
    toolName: getToolBySlug(g.toolSlug)?.name ?? g.toolSlug,
    stageId: g.stageId,
    model: g.model,
    outputLanguage: g.outputLanguage,
    outputMarkdown: g.outputMarkdown,
    createdAt: g.createdAt,
    courseLinks: links.byGeneration[g.id] ?? [],
  }));
  // The BDB/BKE workplace switched off (P27): no "Toevoegen aan dossier".
  const dossiers = (await portfolioAccess(user))
    ? (await listDossiers(user.id)).map((d) => ({ id: d.id, name: d.name }))
    : [];
  return { generations, dossiers, courses: links.targets };
}

export default function Projects({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { generations, dossiers = [], courses = [] } = loaderData;
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return "error" in d && d.error ? { variant: "error", message: d.error } : null;
      return {
        variant: "success",
        message:
          d.intent === "addToDossier"
            ? t.portfolio.toastAddedToDossier
            : d.intent === "linkCourse"
              ? t.courses.links.toastLinked
              : d.intent === "unlinkCourse"
                ? t.courses.links.toastUnlinked
                : t.projects.toastDeleted,
      };
    },
  });
  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.nav.projects}
      </h1>
      <p className="mt-2 text-slate-600">{t.projects.subtitle}</p>
      <HelpLink topic="saved-work" />

      {generations.length === 0 ? (
        <EmptyState
          icon={<FolderOpen aria-hidden />}
          title={t.projects.emptyTitle}
          body={t.projects.emptyBody}
          action={{ to: "/tools", label: t.projects.emptyAction }}
        />
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
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{loc(g.toolName, locale)}</span>
                      {g.stageId && <Badge>{g.stageId}</Badge>}
                      <CourseLinkBadges links={g.courseLinks ?? []} />
                    </div>
                    <p className="truncate text-xs text-slate-500">
                      {fmtDate(g.createdAt, locale)} · {g.model} · {g.outputLanguage.toUpperCase()}
                    </p>
                  </div>
                </summary>
                <div className="space-y-3 border-t border-slate-100 p-3">
                  <ResultPanel markdown={g.outputMarkdown} title={loc(g.toolName, locale)} />
                  {/* Feedback lives on the projects list: every generation — one-shot,
                      multi-stage, and chat sessions (saved as one row) — is ratable
                      here by its known id, without plumbing ids through the SSE stream. */}
                  <ExportMenu generationId={g.id} />
                  <FeedbackWidget generationId={g.id} />
                  <CourseLinkForm
                    generationId={g.id}
                    targets={courses}
                    links={g.courseLinks ?? []}
                  />
                  {dossiers.length > 0 && (
                    <Form method="post" className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="intent" value="addToDossier" />
                      <input type="hidden" name="id" value={g.id} />
                      <div>
                        <Label htmlFor={`dossier-${g.id}`}>{t.portfolio.addToDossierLabel}</Label>
                        <Select id={`dossier-${g.id}`} name="dossierId">
                          {dossiers.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button type="submit" variant="secondary" size="sm">
                        {t.portfolio.addToDossier}
                      </Button>
                    </Form>
                  )}
                </div>
              </details>
              <div className="absolute right-3 top-2.5">
                <ConfirmDialog
                  triggerLabel={t.projects.delete}
                  triggerIcon={<Trash2 className="size-4" aria-hidden />}
                  triggerIconOnly
                  title={t.projects.deleteTitle}
                  description={t.projects.deleteBody}
                  confirmLabel={t.projects.delete}
                  cancelLabel={t.confirm.cancel}
                  fields={{ intent: "delete", id: g.id }}
                />
              </div>
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
