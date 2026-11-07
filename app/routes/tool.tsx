import { useState } from "react";
import { Link } from "react-router";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import type { Route } from "./+types/tool";
import { getToolBySlugOrThrow } from "~/lib/registry";
import {
  getSelectableModels,
  isToolAvailable,
  narrowLocalModels,
} from "~/server/availability.server";
import { requireUser } from "~/server/auth.server";
import type { InteractionMode } from "~/lib/registry/types";
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
import { GeneratorView } from "~/components/GeneratorView";
import { StageStepper } from "~/components/StageStepper";
import { ChatView } from "~/components/ChatView";
import { ToolIcon } from "~/components/ToolIcon";
import { Markdown } from "~/components/Markdown";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { ToolSubtitle } from "~/components/ToolTitle";
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
  };
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
  } = loaderData;
  const resultContext = { nextTools, linkTargets, dossiers, forCriterion };
  const multiStage = tool.stages.length > 1;
  const isChat = tool.mode === "chat";

  return (
    <div className={cn(isChat && "flex min-h-0 flex-1 flex-col")}>
      {forCriterion && <DossierBar {...forCriterion} />}
      <ToolHeader tool={tool} verbatim={verbatim} helpOverlay={helpOverlay} locale={locale} t={t} />

      <section
        id="tool-workspace"
        className={cn(
          "scroll-mt-24",
          // On md+ the chat workspace fills the remaining height and pins its
          // composer, but keeps a min-height floor so it never collapses when an
          // expanded ToolHeader pushes it down — the page scrolls instead.
          isChat && "flex min-h-0 flex-1 flex-col md:min-h-[30rem]",
        )}
      >
        {isChat ? (
          <ChatView
            tool={tool}
            contextProfile={profiles.find((p) => p.id === defaultProfileId) || null}
            defaultModel={undefined}
            outputLanguage={undefined}
            localModels={localModels}
            catalogModels={catalogModels}
            courses={courses}
            initialCourseId={initialCourseId}
            initialItemId={initialItemId}
            resultContext={resultContext}
            studentPrompt={studentPrompt ?? undefined}
          />
        ) : multiStage ? (
          <StageStepper
            tool={tool}
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            localModels={localModels}
            catalogModels={catalogModels}
            courses={courses}
            initialCourseId={initialCourseId}
            initialItemId={initialItemId}
            resultContext={resultContext}
          />
        ) : (
          <GeneratorView
            tool={tool}
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            localModels={localModels}
            catalogModels={catalogModels}
            courses={courses}
            initialCourseId={initialCourseId}
            initialItemId={initialItemId}
            resultContext={resultContext}
          />
        )}
      </section>
    </div>
  );
}

type Tool = Route.ComponentProps["loaderData"]["tool"];
type Verbatim = Route.ComponentProps["loaderData"]["verbatim"];
type T = ReturnType<typeof useT>;

/**
 * Compact "command bar" header (design: Direction A — Compacte commandobalk).
 * Orient + start sit on two lines; the research provenance (theory, source,
 * adapted notice, original prompt, how-to-use) collapses behind one disclosure
 * so it never pushes the workspace down.
 */
function ToolHeader({
  tool,
  verbatim,
  helpOverlay,
  locale,
  t,
}: {
  tool: Tool;
  verbatim: Verbatim;
  helpOverlay: string | null;
  locale: Locale;
  t: T;
}) {
  const [open, setOpen] = useState(false);
  const a = tool.attribution;
  const multiStage = tool.stages.length > 1;

  return (
    <div className="mb-6">
      <nav
        aria-label={t.tool.breadcrumb}
        className="mb-3 flex items-center gap-1.5 text-[13px] text-slate-500"
      >
        <Link to="/tools" className="transition-colors hover:text-violet-600">
          {t.nav.tools}
        </Link>
        <ChevronRight className="size-3.5 text-slate-400" aria-hidden />
        <span className="truncate font-medium text-slate-700">{loc(tool.name, locale)}</span>
      </nav>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="grid size-[52px] shrink-0 place-items-center rounded-[14px] bg-violet-50 text-violet-600">
            <ToolIcon name={tool.icon} className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
                {loc(tool.name, locale)}
              </h1>
              {multiStage ? (
                <StagePill count={tool.stages.length} t={t} />
              ) : (
                <ModePill mode={tool.mode} t={t} />
              )}
            </div>
            <ToolSubtitle subtitle={tool.subtitle} locale={locale} className="mt-0.5" />
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600 sm:line-clamp-1">
              {loc(tool.tagline, locale)}
            </p>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col-reverse items-stretch gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="tool-provenance"
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
              open
                ? "border-violet-200 bg-violet-50 text-violet-700"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <BookOpen className="size-4" aria-hidden />
            {t.tool.provenance}
            <ChevronDown
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {open && (
        <div
          id="tool-provenance"
          className="mt-2.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-7 sm:grid-cols-[1.5fr_1fr]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-brass-600">
                {t.tool.theory}
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpen className="size-4 shrink-0 text-violet-600" aria-hidden />
                {loc(tool.theory.name, locale)}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {loc(tool.theory.summary, locale)}
              </p>
              {tool.theory.keyCitations.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {tool.theory.keyCitations.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="border-slate-100 sm:border-l sm:pl-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-brass-600">
                {t.tool.source}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {a.original ? (
                  <>
                    {t.tool.sourceOriginal}:{" "}
                    <span className="italic text-slate-600">
                      {a.source ? loc(a.source, locale) : "LimeOnIt"}
                    </span>
                    . {a.license}.
                  </>
                ) : (
                  <>
                    <span className="italic text-slate-600">{a.chapterTitle}</span> — {a.authors}.{" "}
                    {a.bookTitle} ({a.editor}, {a.year}). {a.sourcePages}. {a.license}.
                  </>
                )}
                {a.evaluatedWith
                  ? ` ${fmt(t.tool.evaluatedWith, { model: loc(a.evaluatedWith, locale) })}`
                  : ""}
              </p>

              {a.adapted && (
                <p className="mt-2.5 flex items-start gap-1.5 text-xs text-amber-800">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {a.adaptation ? loc(a.adaptation, locale) : t.tool.adaptedNotice}
                </p>
              )}
              {a.improvedAfter && (
                <p className="mt-2 text-xs text-emerald-800">
                  {fmt(t.tool.improvedAfter, { date: a.improvedAfter.date })}{" "}
                  {loc(a.improvedAfter.summary, locale)}
                </p>
              )}

              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium text-violet-600 hover:underline">
                  {t.tool.viewOriginal}
                </summary>
                <div className="mt-2 space-y-3">
                  {verbatim.map((v) => (
                    <div key={loc(v.name, locale)}>
                      {multiStage && (
                        <div className="text-xs font-semibold text-slate-500">
                          {loc(v.name, locale)}
                        </div>
                      )}
                      <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                        {v.text}
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
            <Link
              to={`/help/${tool.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline"
            >
              <HelpCircle className="size-4" aria-hidden /> {t.help.fullHelp}
            </Link>
          </div>

          {helpOverlay && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-violet-600 hover:underline">
                {t.help.howToUse}
              </summary>
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4">
                <Markdown>{helpOverlay}</Markdown>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function StagePill({ count, t }: { count: number; t: T }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#ecdcc0] bg-amber-50 py-0.5 pl-2 pr-2.5 text-xs font-semibold text-brass-600">
      <span className="flex gap-0.5" aria-hidden>
        {["d1", "d2", "d3", "d4"].slice(0, Math.min(count, 4)).map((d) => (
          <span key={d} className="size-[5px] rounded-full bg-brass-500" />
        ))}
      </span>
      {fmt(t.home.stages, { count })}
    </span>
  );
}

function ModePill({ mode, t }: { mode: InteractionMode; t: T }) {
  const isChat = mode === "chat";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2 text-[11px] font-semibold",
        isChat ? "bg-slate-100 text-slate-600" : "bg-violet-50 text-violet-700",
      )}
    >
      {isChat ? (
        <MessagesSquare className="size-3" aria-hidden />
      ) : (
        <Sparkles className="size-3" aria-hidden />
      )}
      {isChat ? t.home.mode.chatbot : t.home.mode.generator}
    </span>
  );
}
