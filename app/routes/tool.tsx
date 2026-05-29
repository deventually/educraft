import { Link } from "react-router";
import { ArrowLeft, BookOpen, Info } from "lucide-react";
import type { Route } from "./+types/tool";
import { getToolBySlugOrThrow } from "~/lib/registry";
import { getVerbatimPrompt } from "~/lib/prompts";
import { listProfiles, getDefaultProfile } from "~/server/repositories/profiles.server";
import { GeneratorView } from "~/components/GeneratorView";
import { StageStepper } from "~/components/StageStepper";
import { ToolIcon } from "~/components/ToolIcon";
import { Badge } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function loader({ params }: Route.LoaderArgs) {
  const tool = getToolBySlugOrThrow(params.slug);
  const profiles = listProfiles();
  const defaultProfile = getDefaultProfile();
  const verbatim = tool.stages.map((s) => ({
    name: s.name,
    text: getVerbatimPrompt(s.systemPromptId),
  }));
  return { tool, profiles, defaultProfileId: defaultProfile?.id ?? "", verbatim };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.tool.nameNl} — EduCraft` : "EduCraft" }];
}

export default function ToolPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const { tool, profiles, defaultProfileId, verbatim } = loaderData;
  const a = tool.attribution;
  const multiStage = tool.stages.length > 1;

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" /> {t.nav.tools}
      </Link>

      <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
            <ToolIcon name={tool.icon} className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tool.nameNl}</h1>
              <Badge>{tool.userType === "instructor" ? t.badge.instructor : t.badge.student}</Badge>
            </div>
            <p className="mt-1 text-slate-600">{tool.taglineNl}</p>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <BookOpen className="size-4 text-violet-600" /> {t.tool.theory}: {tool.theory.name}
              </div>
              <p className="mt-1 text-sm text-slate-600">{tool.theory.summaryNl}</p>
              {tool.theory.keyCitations.length > 0 && (
                <p className="mt-1 text-xs text-slate-400">{tool.theory.keyCitations.join(" · ")}</p>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              {t.tool.source}: <span className="italic">{a.chapterTitle}</span> — {a.authors}.{" "}
              {a.bookTitle} ({a.editor}, {a.year}). {a.sourcePages}. {a.license}.
              {a.evaluatedWith ? ` ${fmt(t.tool.evaluatedWith, { model: a.evaluatedWith })}` : ""}
            </p>

            {a.adapted && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {t.tool.adaptedNotice}
              </p>
            )}

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-violet-600 hover:underline">
                {t.tool.viewOriginal}
              </summary>
              <div className="mt-2 space-y-3">
                {verbatim.map((v) => (
                  <div key={v.name}>
                    {multiStage && <div className="text-xs font-semibold text-slate-500">{v.name}</div>}
                    <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                      {v.text}
                    </pre>
                  </div>
                ))}
              </div>
            </details>
          </div>
        </div>
      </header>

      {multiStage ? (
        <StageStepper tool={tool} profiles={profiles} defaultProfileId={defaultProfileId} />
      ) : (
        <GeneratorView tool={tool} profiles={profiles} defaultProfileId={defaultProfileId} />
      )}
    </div>
  );
}
