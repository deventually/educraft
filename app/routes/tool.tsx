import type { Route } from "./+types/tool";
import { getToolBySlugOrThrow } from "~/lib/registry";
import {
  getSelectableModels,
  isToolAvailable,
  narrowLocalModels,
} from "~/server/availability.server";
import { requireUser } from "~/server/auth.server";
import { getVerbatimPrompt } from "~/lib/prompts";
import { studentPromptTemplates } from "~/lib/template/studentPromptTemplate";
import { discoverLocalModels } from "~/lib/ai/discover.server";
import { localModelsEnabled } from "~/server/env.server";
import { listProfiles, getDefaultProfile } from "~/server/repositories/profiles.server";
import { listCourses } from "~/server/repositories/courses.server";
import { listDossiers } from "~/server/repositories/portfolio.server";
import { courseLinkIntent } from "~/server/courses.server";
import { addGenerationToDossier } from "~/server/evidence.server";
import { portfolioAccess } from "~/server/portfolioAccess.server";
import { DossierBar } from "~/components/portfolio/DossierBar";
import { outcomeLabel } from "~/lib/portfolio/format";
import { linkTargets } from "~/lib/courses/links";
import { getToolBySlug } from "~/lib/registry";
import { getToolHelpOverlay } from "~/lib/help/registry";
import { getLocale } from "~/lib/i18n/locale.server";
import { cn } from "~/lib/utils";
import { modeOf } from "~/lib/registry/modes";
import { ToolHeader } from "~/components/tool/ToolHeader";
import { ToolWorkspace } from "~/components/tool/ToolWorkspace";
import { useT, useLocale } from "~/lib/i18n/useT";
import { listAssessmentModels } from "~/server/repositories/assessmentModels.server";
import { type ModelChoice, STARTER_MODELS } from "~/lib/assessment-models";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { DEFAULT_LOCALE, type Locale } from "~/lib/i18n";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const tool = getToolBySlugOrThrow(params.slug);
  // A tool the instance has disabled is indistinguishable from a non-existent tool
  // (no info leak).
  if (!(await isToolAvailable(user, tool))) throw new Response("Not Found", { status: 404 });

  const profiles = await listProfiles(user.id);
  const defaultProfile = await getDefaultProfile(user.id);
  const verbatim = tool.stages.map((s) => ({
    name: s.name,
    text: getVerbatimPrompt(s.systemPromptId),
  }));
  // Discovered local models, narrowed to the viewer's effective set: an admin/teacher
  // may curate them, so a disabled/un-granted one must never reach the picker.
  // Local models exist only outside production (P18): skip discovery there, which also
  // saves its 1.5 s time-out on every tool page.
  const discovered = (localModelsEnabled() ? await discoverLocalModels() : []).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    supportsImages: m.supportsImages,
    supportsThinking: m.supportsThinking,
  }));
  const localModels = await narrowLocalModels(user, discovered);
  // The catalog models a caller may pick, narrowed to the viewer's effective set
  // (instance allow-list, or the teacher's own set). Passed
  // to the pickers so the module-scope catalog no longer wins.
  const catalogModels = await getSelectableModels(user);
  const helpOverlay = getToolHelpOverlay(tool.id, getLocale(request));
  // Courses only for a tool that can take its learning outcomes (P20.4); the picker
  // needs just the outcome texts, not the whole plan.
  const usesCourses = tool.inputs.some((f) => f.prefillFromCourse);
  const ownCourses = await listCourses(user.id);
  const courses = usesCourses
    ? ownCourses.map((c) => ({
        id: c.id,
        name: c.name,
        contextProfileId: c.contextProfileId,
        outcomes: c.data.outcomes.map((o) => ({ text: o.text })),
      }))
    : [];
  // P27.1: a next step opens with `?course=`; only an own course is taken over.
  const search = new URL(request.url).searchParams;
  const wanted = search.get("course") ?? "";
  const initialCourse = ownCourses.find((c) => c.id === wanted);
  const initialCourseId = initialCourse ? wanted : "";
  // P27.4: opened from a lesson or test (`?item=`); only an item of that own course.
  const wantedItem = search.get("item") ?? "";
  const initialItemId =
    initialCourse &&
    [...initialCourse.data.activities, ...initialCourse.data.assessments].some(
      (i) => i.id === wantedItem,
    )
      ? wantedItem
      : "";
  const nextTools = await nextStepsFor(user, tool.next ?? []);
  const assessmentModels = tool.assessmentModels
    ? await assessmentModelChoices(user.id, getLocale(request))
    : [];
  // P31.1: only a copyable tutor sends its student text, with the form fields still open.
  const studentPrompt = tool.copyableStudentPrompt
    ? studentPromptTemplates(tool, defaultProfile)
    : null;
  // The BDB/BKE workplace switched off (P27): no dossiers, so no evidence choice.
  const ownDossiers = (await portfolioAccess(user)) ? await listDossiers(user.id) : [];
  const dossiers = ownDossiers.map((d) => ({
    id: d.id,
    name: d.name,
    criteria: d.data.framework.outcomes.flatMap((o) =>
      o.criteria.map((c) => ({ id: c.id, label: `${o.code} · ${shorten(c.text, 90)}` })),
    ),
  }));
  return {
    forCriterion: forCriterion(ownDossiers, new URL(request.url).searchParams),
    tool,
    profiles,
    defaultProfileId: defaultProfile?.id ?? "",
    verbatim,
    studentPrompt,
    localModels,
    catalogModels,
    helpOverlay,
    courses,
    initialCourseId,
    initialItemId,
    nextTools,
    linkTargets: linkTargets(ownCourses),
    dossiers,
    assessmentModels,
  };
}

/** The teacher's own assessment models, then the starters, in the page's language. */
async function assessmentModelChoices(userId: string, locale: Locale): Promise<ModelChoice[]> {
  const own = (await listAssessmentModels(userId)).map((m) => ({
    id: m.id,
    name: m.name,
    ...m.data,
    starter: false,
  }));
  const starters = STARTER_MODELS.map((s) => ({
    id: `starter:${s.id}`,
    name: s.name[locale],
    documentTypes: s.documentTypes,
    framework: s.framework[locale],
    scale: s.scale[locale],
    starter: true,
  }));
  return [...own, ...starters];
}

/** The next steps the viewer may use, with their names (P27.1). */
async function nextStepsFor(user: Awaited<ReturnType<typeof requireUser>>, slugs: string[]) {
  const out: { slug: string; name: LocalizedText }[] = [];
  for (const slug of slugs) {
    const next = getToolBySlug(slug);
    if (next && (await isToolAvailable(user, next))) out.push({ slug, name: next.name });
  }
  return out;
}

/**
 * P27.2: a tool opened from a dossier criterion (`?dossier=&criterion=`). Only the
 * caller's own dossier and an existing criterion count; anything else is no bar, no error.
 */
function forCriterion(dossiers: Awaited<ReturnType<typeof listDossiers>>, params: URLSearchParams) {
  const dossier = dossiers.find((d) => d.id === params.get("dossier"));
  const criterionId = params.get("criterion");
  for (const o of dossier?.data.framework.outcomes ?? []) {
    const c = o.criteria.find((x) => x.id === criterionId);
    if (dossier && c)
      return {
        dossierId: dossier.id,
        dossierName: dossier.name,
        outcomeId: o.id,
        outcomeLabel: outcomeLabel(o),
        criterionId: c.id,
        criterionText: c.text,
      };
  }
  return null;
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Keeping a result (P27.1): link it to a course, or add it to a dossier as evidence. */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  const linked = await courseLinkIntent(request, user.id, fd);
  if (linked) return linked;
  if (fd.get("intent") === "addToDossier") {
    const added = await addGenerationToDossier(
      user,
      {
        generationId: String(fd.get("id") ?? ""),
        dossierId: String(fd.get("dossierId") ?? ""),
        criterionId: String(fd.get("criterionId") ?? "") || null,
      },
      getLocale(request),
    );
    return added.ok ? { ok: true as const, intent: "addToDossier" as const } : added;
  }
  return { ok: false as const };
}

export function meta({ loaderData: data, matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const locale = root?.locale ?? DEFAULT_LOCALE;
  return [{ title: data ? `${loc(data.tool.name, locale)} — LimeOnIt` : "LimeOnIt" }];
}

export default function ToolPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const {
    tool,
    profiles,
    defaultProfileId,
    verbatim,
    studentPrompt,
    localModels,
    catalogModels,
    helpOverlay,
    courses,
    initialCourseId,
    initialItemId,
    nextTools,
    linkTargets,
    dossiers,
    forCriterion,
    assessmentModels,
  } = loaderData;
  const resultContext = { nextTools, linkTargets, dossiers, forCriterion };
  const mode = modeOf(tool);

  return (
    <div className={cn(mode.fillsHeight && "flex min-h-0 flex-1 flex-col")}>
      {forCriterion && <DossierBar {...forCriterion} />}
      <ToolHeader tool={tool} verbatim={verbatim} helpOverlay={helpOverlay} locale={locale} t={t} />

      <section
        id="tool-workspace"
        className={cn(
          "scroll-mt-24",
          // On md+ a chat workspace fills the remaining height and pins its
          // composer, but keeps a min-height floor so it never collapses when an
          // expanded ToolHeader pushes it down — the page scrolls instead.
          mode.fillsHeight && "flex min-h-0 flex-1 flex-col md:min-h-[30rem]",
        )}
      >
        <ToolWorkspace
          kind={mode.kind}
          tool={tool}
          profiles={profiles}
          defaultProfileId={defaultProfileId}
          localModels={localModels}
          catalogModels={catalogModels}
          courses={courses}
          initialCourseId={initialCourseId}
          initialItemId={initialItemId}
          resultContext={resultContext}
          studentPrompt={studentPrompt ?? undefined}
          assessmentModels={assessmentModels}
        />
      </section>
    </div>
  );
}
