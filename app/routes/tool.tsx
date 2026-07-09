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
  cohortConfig,
  getCohortForUser,
  isCohortActive,
} from "~/server/repositories/cohorts.server";
import {
  getSelectableModels,
  isToolAvailable,
  narrowLocalModels,
} from "~/server/availability.server";
import { requireUser } from "~/server/auth.server";
import { getEffectiveRole } from "~/server/roleView.server";
import type { InteractionMode } from "~/lib/registry/types";
import { getVerbatimPrompt } from "~/lib/prompts";
import { discoverLocalModels } from "~/lib/ai/discover.server";
import { listProfiles, getDefaultProfile } from "~/server/repositories/profiles.server";
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
import { loc } from "~/lib/i18n/localized";
import { DEFAULT_LOCALE, type Locale } from "~/lib/i18n";

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const tool = getToolBySlugOrThrow(params.slug);
  // A tool the instance has disabled, an instructor tool for a student, a student
  // tool outside their cohort's allow-list, a tool outside a narrowed teacher's
  // allow-list, or any tool once the cohort's window has passed — all
  // indistinguishable from a non-existent tool (no info leak). Effective
  // availability (Phase 4) composes the instance + role/cohort + teacher gates;
  // an admin who "views as teacher" is gated as a teacher.
  const viewer = { ...user, role: getEffectiveRole(user, request) };
  const cohort = viewer.role === "student" ? await getCohortForUser(user.id) : null;
  if (!(await isToolAvailable(viewer, tool))) throw new Response("Not Found", { status: 404 });
  if (cohort && !isCohortActive(cohort)) throw new Response("Not Found", { status: 404 });

  // A provisioned student lands straight in the chat: the sandbox is prefilled +
  // locked from the cohort config, and no profile is offered (the cohort profile
  // is injected server-side by membership). Teachers/admins keep today's
  // behaviour — their own profiles + an editable sandbox.
  const lockedValues = cohort ? (cohortConfig(cohort)[tool.slug]?.values ?? {}) : null;
  const profiles = lockedValues ? [] : await listProfiles(user.id);
  const defaultProfile = lockedValues ? null : await getDefaultProfile(user.id);
  const verbatim = tool.stages.map((s) => ({
    name: s.name,
    text: getVerbatimPrompt(s.systemPromptId),
  }));
  // Discovered local models, narrowed to the viewer's effective set (Phase 14):
  // local/CLI/discovered models are no longer free-passed — an admin/teacher may
  // curate them, so a disabled/un-granted one must never reach the picker.
  const discovered = (await discoverLocalModels()).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    supportsImages: m.supportsImages,
    supportsThinking: m.supportsThinking,
  }));
  const localModels = await narrowLocalModels(viewer, discovered);
  // The catalog models a caller may pick, narrowed to the viewer's effective set
  // (Phase 4 instance allow-list + Phase 13 per-teacher / per-cohort gates). Passed
  // to the pickers so the module-scope catalog no longer wins.
  const catalogModels = await getSelectableModels(viewer);
  const helpOverlay = getToolHelpOverlay(tool.id, getLocale(request));
  return {
    tool,
    profiles,
    defaultProfileId: defaultProfile?.id ?? "",
    verbatim,
    localModels,
    catalogModels,
    helpOverlay,
    lockedValues,
  };
}

export function meta({ data, matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
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
    localModels,
    catalogModels,
    helpOverlay,
    lockedValues,
  } = loaderData;
  const multiStage = tool.stages.length > 1;
  const isChat = tool.mode === "chat";

  return (
    <div className={cn(isChat && "flex min-h-0 flex-1 flex-col")}>
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
            lockedValues={lockedValues ?? undefined}
          />
        ) : multiStage ? (
          <StageStepper
            tool={tool}
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            localModels={localModels}
            catalogModels={catalogModels}
          />
        ) : (
          <GeneratorView
            tool={tool}
            profiles={profiles}
            defaultProfileId={defaultProfileId}
            localModels={localModels}
            catalogModels={catalogModels}
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
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                {tool.userType === "instructor" ? t.badge.instructor : t.badge.student}
              </span>
              {multiStage ? (
                <StagePill count={tool.stages.length} t={t} />
              ) : (
                <ModePill mode={tool.mode} t={t} />
              )}
            </div>
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
                  {t.tool.adaptedNotice}
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
