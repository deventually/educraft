import { useRef, useState } from "react";
import { Sparkles, Square, AlertTriangle, Lock, RotateCcw } from "lucide-react";
import type { Tool, OutputLanguage, ToolStage } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import { DynamicForm, missingRequired } from "./DynamicForm";
import { useSandbox, type SandboxCourse } from "~/lib/hooks/useSandbox";
import { CoursePicker } from "./CoursePicker";
import { ResultActions, type ResultContext } from "./ResultActions";
import { ToolControls, type PickerModel } from "./ToolControls";
import { initialPickerModel, pickableModels } from "~/lib/ai/models";
import { ResultPanel } from "./ResultPanel";
import { AiNotice } from "./AiNotice";
import { Badge, Button } from "./ui";
import { streamPost } from "~/lib/streamClient";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
// i18n: all visible strings resolved via useT()/loc() (locale-aware).

interface Props {
  tool: Tool;
  profiles: ContextProfile[];
  defaultProfileId: string;
  localModels?: PickerModel[];
  catalogModels?: PickerModel[];
  /** The teacher's courses (P20.4/P27.1), for the course picker and its prefill. */
  courses?: (SandboxCourse & { name: string })[];
  /** The course to start on (P27.1, `?course=`). */
  initialCourseId?: string;
  /** The course item to link the result to (P27.4, `?item=`). */
  initialItemId?: string;
  /** Next steps and places to keep the result (P27.1). */
  resultContext?: ResultContext;
}

interface StageState {
  output: string;
  streaming: boolean;
  error: string | null;
}

export function StageStepper({
  tool,
  profiles,
  defaultProfileId,
  localModels,
  catalogModels,
  courses,
  initialCourseId,
  initialItemId,
  resultContext,
}: Props) {
  const t = useT();
  const locale = useLocale();
  // Shared sandbox (see useSandbox). Cognitive Architect has no profile-backed
  // fields, so `selectProfile` here is just the context selector; the hook keeps
  // the door open for prefill without special-casing the multi-stage surface.
  const { values, setValue, contextProfileId, selectProfile, courseId, selectCourse, itemId } =
    useSandbox({
      inputs: tool.inputs,
      profiles,
      defaultProfileId,
      courses,
      initialCourseId,
      initialItemId,
    });
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(tool.defaultOutputLanguage);
  // Pre-select an OFFERED model, not blindly the tool default: a teacher
  // whose set holds only a local model must not start on the frontier default.
  const [model, setModel] = useState(() =>
    initialPickerModel(pickableModels(localModels ?? [], false, catalogModels), tool.defaultModel),
  );
  const [stages, setStages] = useState<Record<string, StageState>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // The work saved by the latest finished stage (P27.1): what "keep" and "next" act on.
  const [lastGenerationId, setLastGenerationId] = useState<string | null>(null);
  // P30.1: the saved result of each step, so the export holds all of them in one file.
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const abortRefs = useRef<Record<string, AbortController>>({});

  const outputs = (): Record<string, string> =>
    Object.fromEntries(
      Object.entries(stages)
        .filter(([, s]) => s.output)
        .map(([id, s]) => [id, s.output]),
    );

  function depsReady(stage: ToolStage): boolean {
    return (stage.consumes ?? []).every((d) => Boolean(stages[d.fromStageId]?.output));
  }

  function setStage(id: string, patch: Partial<StageState>) {
    setStages((prev) => {
      const existing: StageState = prev[id] ?? { output: "", streaming: false, error: null };
      return { ...prev, [id]: { ...existing, ...patch } };
    });
  }

  async function runStage(stage: ToolStage) {
    const isEntry = !stage.consumes?.length;
    if (isEntry) {
      const missing = missingRequired(tool.inputs, values);
      if (missing.length) {
        setFormError(`${t.tool.required}: ${missing.map((f) => loc(f.label, locale)).join(", ")}`);
        return;
      }
      setFormError(null);
    }
    setStage(stage.id, { output: "", streaming: true, error: null });
    const ctrl = new AbortController();
    abortRefs.current[stage.id] = ctrl;
    await streamPost(
      "/api/stream",
      {
        slug: tool.slug,
        stageId: stage.id,
        values,
        contextProfileId,
        outputLanguage,
        model,
        priorOutputs: outputs(),
        courseId: courseId || undefined,
        itemId: (courseId && itemId) || undefined,
      },
      {
        onToken: (text) =>
          setStages((prev) => {
            const existing: StageState = prev[stage.id] ?? {
              output: "",
              streaming: true,
              error: null,
            };
            return {
              ...prev,
              [stage.id]: { ...existing, output: existing.output + text },
            };
          }),
        onDone: (meta) => {
          setStage(stage.id, { streaming: false });
          const savedId = meta?.generationId;
          if (savedId) {
            setLastGenerationId(savedId);
            setSavedIds((prev) => ({ ...prev, [stage.id]: savedId }));
          }
        },
        onError: (err) =>
          setStage(stage.id, { streaming: false, error: err.message ?? t.error.unknown }),
      },
      ctrl.signal,
    );
  }

  function stop(id: string) {
    abortRefs.current[id]?.abort();
    setStage(id, { streaming: false });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-4">
        {/* First, because choosing a course fills the learning outcomes below it. */}
        <CoursePicker courses={courses ?? []} value={courseId} onChange={selectCourse} />
        <ToolControls
          usesContextProfile={tool.usesContextProfile}
          profiles={profiles}
          contextProfileId={contextProfileId}
          onProfile={selectProfile}
          outputLanguage={outputLanguage}
          onLanguage={setOutputLanguage}
          model={model}
          onModel={setModel}
          localModels={localModels}
          catalogModels={catalogModels}
        />
        <DynamicForm fields={tool.inputs} values={values} onChange={setValue} />
        {formError && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {formError}
          </p>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        {tool.stages.map((stage) => {
          const st = stages[stage.id];
          const ready = depsReady(stage);
          const hasOutput = Boolean(st?.output);
          return (
            <div key={stage.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">{loc(stage.name, locale)}</h3>
                    {stage.optional && <Badge>{t.tool.optionalStage}</Badge>}
                  </div>
                  {stage.description && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {loc(stage.description, locale)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {st?.streaming ? (
                    <Button size="sm" variant="secondary" onClick={() => stop(stage.id)}>
                      <Square className="size-4" /> {t.tool.stop}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={hasOutput ? "secondary" : "primary"}
                      onClick={() => runStage(stage)}
                      disabled={!ready}
                      title={ready ? undefined : t.tool.stageLocked}
                    >
                      {!ready ? (
                        <Lock className="size-4" />
                      ) : hasOutput ? (
                        <RotateCcw className="size-4" />
                      ) : (
                        <Sparkles className="size-4" />
                      )}
                      {hasOutput ? t.tool.regenerate : t.tool.runStage}
                    </Button>
                  )}
                </div>
              </div>
              {(hasOutput || st?.streaming) && (
                <div className="p-3">
                  <ResultPanel
                    markdown={st?.output ?? ""}
                    title={loc(stage.name, locale)}
                    streaming={st?.streaming}
                    lang={outputLanguage}
                  />
                </div>
              )}
              {st?.error && (
                <p className="mx-4 mb-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {st.error}
                </p>
              )}
            </div>
          );
        })}
        {resultContext &&
          Object.values(stages).some((st) => st.output) &&
          !Object.values(stages).some((st) => st.streaming) && (
            <ResultActions
              {...resultContext}
              generationId={lastGenerationId}
              exportWith={Object.values(savedIds).filter((id) => id !== lastGenerationId)}
              courseId={courseId}
              itemId={itemId}
            />
          )}
        {/* Persistent AI-transparency notice under the staged results. */}
        <AiNotice variant={tool.assistiveGrading ? "assistive" : "generic"} />
      </div>
    </div>
  );
}
