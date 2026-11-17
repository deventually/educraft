import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Sparkles, Square } from "lucide-react";
import type { Tool, OutputLanguage } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import { DynamicForm, missingRequired } from "./DynamicForm";
import { imagesOf, toTemplateValues } from "~/lib/forms/values";
import { useSandbox, type SandboxCourse } from "~/lib/hooks/useSandbox";
import { useStreamAborts } from "~/lib/hooks/useStreamAborts";
import { useEntryMemory } from "~/lib/hooks/useEntryMemory";
import { GeneratorMemorySchema } from "~/lib/tool/memory";
import { ToolControls, type PickerModel } from "./ToolControls";
import { CoursePicker } from "./CoursePicker";
import { useAssessmentModelPicker } from "./assessment-models/AssessmentModelPicker";
import type { ModelChoice } from "~/lib/assessment-models";
import { initialPickerModel, pickableModels } from "~/lib/ai/models";
import { ResultPanel } from "./ResultPanel";
import { computeResultNote } from "~/lib/template/computations";
import { guardOutput } from "~/lib/template/guards";
import { ResultActions, type ResultContext } from "./ResultActions";
import { ResultFooter } from "./ResultFooter";
import { Button } from "./ui";
import { cn } from "~/lib/utils";
import { streamPost } from "~/lib/streamClient";
import { useHandoff } from "~/lib/hooks/useHandoff";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { FormResultLayout } from "~/components/FormResultLayout";
import { DocumentViewer } from "./documents/DocumentViewer";
import { extractQuotes } from "~/lib/documents/locate";
import { restoreNames, type CodeTable } from "~/lib/privacy/redact";
import { privacyFields, usePrivacy } from "~/lib/hooks/usePrivacy";
import type { PrivacyPage } from "~/lib/privacy/live";
import { PrivacyAskCard, PrivacyPreview } from "./privacy/PrivacyPreview";

interface Props {
  tool: Tool;
  profiles: ContextProfile[];
  defaultProfileId: string;
  localModels?: PickerModel[];
  catalogModels?: PickerModel[];
  /** The teacher's courses (P20.4), for the course picker and its prefill. */
  courses?: (SandboxCourse & { name: string })[];
  /** The course to start on (P27.1, `?course=`). */
  initialCourseId?: string;
  /** The course item to link the result to (P27.4, `?item=`). */
  initialItemId?: string;
  /** Next steps and places to keep the result (P27.1). */
  resultContext?: ResultContext;
  /** Own and starter assessment models, for a tool with `assessmentModels`. */
  assessmentModels?: ModelChoice[];
  /** This history entry: Back and Forward bring its form and result back. */
  memoryKey?: string;
  /** The names the anonymiseerpoort knows and the teacher's never-list (PR 3). */
  privacy?: PrivacyPage;
}

export function GeneratorView({
  tool,
  profiles,
  defaultProfileId,
  localModels,
  catalogModels,
  courses,
  initialCourseId,
  initialItemId,
  resultContext,
  assessmentModels = [],
  memoryKey,
  privacy: privacyPage,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const stage = tool.stages[0];
  // Shared sandbox: seeds field defaults + the default profile's prefill, and
  // re-derives profile-backed fields on `selectProfile` (see useSandbox).
  const sandbox = useSandbox({
    inputs: tool.inputs,
    profiles,
    defaultProfileId,
    courses,
    initialCourseId,
    initialItemId,
    initialTrack: resultContext?.forTrack,
  });
  const { values, setValue, contextProfileId, selectProfile, courseId, selectCourse, itemId } =
    sandbox;
  useHandoff(tool, setValue);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(tool.defaultOutputLanguage);
  // Check if tool has image inputs (a vision tool narrows the offered models).
  const hasImageInputs = tool.inputs.some((f) => f.kind === "image");
  // Pre-select an OFFERED model, not blindly the tool default: a teacher
  // whose set holds only a local model must not start on the frontier default.
  const [model, setModel] = useState(() =>
    initialPickerModel(
      pickableModels(localModels ?? [], hasImageInputs, catalogModels),
      tool.defaultModel,
    ),
  );
  const [output, setOutput] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const beforeField = useAssessmentModelPicker(tool, assessmentModels, sandbox, streaming);
  const [error, setError] = useState<string | null>(null);
  const streams = useStreamAborts(streaming);
  // Originals of `kind: "document"` fields, by field name. Browser memory only:
  // they are shown in the DocumentViewer and never sent or stored.
  const [originals, setOriginals] = useState<Record<string, File[]>>({});
  const docField = tool.inputs.find((f) => f.kind === "document" && originals[f.name]?.length);
  const docFiles = docField ? originals[docField.name] : undefined;
  // The live preview (anonymiseerpoort PR 3): what goes, seen while typing. The code → name
  // table for the names the teacher gave stays in this component's memory.
  const privacy = usePrivacy(privacyPage);
  const liveFields = privacyFields(tool.inputs, values, locale);
  const reviewing = Boolean(privacy.ask);
  const [codes, setCodes] = useState<CodeTable | null>(null);
  // What was last sent for each anonymised field, next to the form text it came from,
  // so "What the AI receives" shows the codes until the teacher edits that text.
  const [sentRedacted, setSentRedacted] = useState<Record<string, { from: string; to: string }>>(
    {},
  );
  // A result that is still streaming is not kept: coming back shows the form without it.
  useEntryMemory(
    memoryKey,
    GeneratorMemorySchema,
    {
      sandbox: sandbox.memory,
      output: streaming ? "" : output,
      generationId: streaming ? null : generationId,
      outputLanguage,
      model,
      codes,
      sentRedacted,
    },
    (m) => {
      sandbox.restore(m.sandbox);
      setOutput(m.output);
      setGenerationId(m.generationId);
      setOutputLanguage(m.outputLanguage);
      setModel(m.model);
      setCodes(m.codes);
      setSentRedacted(m.sentRedacted);
    },
  );
  // A guard (P36.2) cleans the result as the server keeps it, after the names are back.
  const restored = codes ? restoreNames(output, codes) : output;
  const shown = guardOutput(stage.output.guard, restored, values);
  const quotes = docFiles && shown && !streaming ? extractQuotes(shown) : [];
  // Quotes the viewer found in the original become buttons in the result (P24 follow-up);
  // clicking one asks the viewer to show it.
  const [foundQuotes, setFoundQuotes] = useState<string[]>([]);
  const [focus, setFocus] = useState<{ quote: string; id: number } | undefined>();
  const quoteButtonRef = useRef<HTMLElement | null>(null);
  const showQuote = useCallback((quote: string) => {
    // The clicked quote button, to come back to from the viewer.
    quoteButtonRef.current = document.activeElement as HTMLElement | null;
    setFocus((prev) => ({ quote, id: (prev?.id ?? 0) + 1 }));
  }, []);
  const backToQuote = useCallback(() => {
    const el = quoteButtonRef.current;
    if (!el?.isConnected) return;
    el.scrollIntoView?.({ block: "center", behavior: "smooth" });
    el.focus();
  }, []);

  /** The text that goes (or went) to the AI for a field: the codes once it was anonymised. */
  function aiText(name: string): string {
    const current = String(values[name] ?? "");
    const sent = sentRedacted[name];
    return sent && sent.from === current ? sent.to : current;
  }

  function generate() {
    const missing = missingRequired(tool.inputs, values);
    if (missing.length) {
      setError(`${t.tool.required}: ${missing.map((f) => loc(f.label, locale)).join(", ")}`);
      return;
    }
    setError(null);
    void send();
  }

  async function send() {
    // What the preview showed: the teacher's names as codes, the rest approved for the gate.
    const prepared = privacy.prepare({ fields: liveFields });
    setCodes(Object.keys(prepared.codes).length > 0 ? prepared.codes : null);
    setSentRedacted(
      Object.fromEntries(
        liveFields
          .filter((f) => f.redact)
          .map((f) => [f.name, { from: f.text, to: prepared.values[f.name] ?? f.text }]),
      ),
    );
    setOutput("");
    setGenerationId(null);
    setStreaming(true);
    const signal = streams.start();

    const images = imagesOf(tool.inputs, values);
    // Image fields are sent separately (above); drop them from the prompt values.
    const valuesToSend = { ...toTemplateValues(values), ...prepared.values };

    await streamPost(
      "/api/stream",
      {
        slug: tool.slug,
        stageId: stage.id,
        values: valuesToSend,
        contextProfileId,
        outputLanguage,
        model,
        images: images.length > 0 ? images : undefined,
        courseId: courseId || undefined,
        itemId: (courseId && itemId) || undefined,
        privacy: prepared.approval,
      },
      {
        onToken: (text) => setOutput((prev) => prev + text),
        // The gate found something the teacher did not see: nothing went yet.
        onPrivacy: (items) => {
          setStreaming(false);
          privacy.askFirst(items, () => void send());
        },
        onDone: (meta) => {
          setGenerationId(meta?.generationId ?? null);
          setStreaming(false);
        },
        onError: (err) => {
          // Server errors arrive already localized; a client-side failure carries
          // only a machine code, mapped here to the localized generic message.
          setError(err.message ?? t.error.unknown);
          setStreaming(false);
        },
      },
      signal,
    );
  }

  function stop() {
    streams.abort();
    setStreaming(false);
  }

  // After a result the form can fold away, so the viewer and the result get the width.
  const canFold = Boolean(output) && !streaming && !reviewing;

  return (
    <FormResultLayout
      canFold={canFold}
      form={
        <>
          {/* First, because choosing a course fills the learning outcomes below it. */}
          <CoursePicker
            courses={courses ?? []}
            value={courseId}
            onChange={selectCourse}
            disabled={streaming}
          />
          <DynamicForm
            fields={tool.inputs}
            values={values}
            onChange={setValue}
            onDocumentFiles={(name, files) => setOriginals((prev) => ({ ...prev, [name]: files }))}
            beforeField={beforeField}
          />
          <PrivacyPreview
            privacy={privacy}
            fields={liveFields}
            studentWork={tool.inputs.some((f) => f.redact)}
          />
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
            disabled={streaming}
            requiresImages={hasImageInputs}
          />
          <div className="flex items-center gap-3">
            {streaming ? (
              <Button variant="secondary" onClick={stop}>
                <Square className="size-4" /> {t.tool.stop}
              </Button>
            ) : (
              <Button onClick={generate} disabled={reviewing}>
                <Sparkles className="size-4" /> {t.tool.generate}
              </Button>
            )}
          </div>
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}
        </>
      }
    >
      {(folded) => (
        // Sticky in the shell's scroll region, which starts under the 4rem header (+1px
        // border): 1rem gap above and below, so the notice at its foot stays on screen.
        // When "Export" opens below, the result and the viewer keep a minimum height and
        // the column scrolls, instead of squashing them to their headers.
        // Scrolling clips at the padding edge: 0.25rem of room (-m-1) for an outline or focus ring.
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3 lg:-m-1 lg:h-[calc(100dvh-5.5rem-1px)] lg:self-start lg:overflow-y-auto lg:p-1 lg:overscroll-contain">
          <div
            className={cn(
              "min-h-0 flex-1 lg:min-h-[60dvh]",
              docFiles &&
                (output || streaming) &&
                !reviewing &&
                (folded
                  ? "grid grid-cols-1 gap-3 lg:grid-cols-2"
                  : "grid grid-cols-1 gap-3 lg:grid-rows-2 2xl:grid-cols-2 2xl:grid-rows-1"),
            )}
          >
            {docFiles && docField && !reviewing && (
              <div
                data-viewer-box
                className={cn(
                  // A height of its own, so a long document scrolls inside the viewer.
                  "h-[80dvh] min-h-0 min-w-0 lg:h-full",
                  (output || streaming) && (folded ? "lg:order-2" : "2xl:order-2"),
                )}
              >
                <DocumentViewer
                  files={docFiles}
                  text={aiText(docField.name)}
                  quotes={quotes}
                  onFoundQuotes={setFoundQuotes}
                  focus={focus}
                  onBack={backToQuote}
                />
              </div>
            )}
            {privacy.ask ? (
              <div className="h-full min-h-0 overflow-y-auto">
                <PrivacyAskCard
                  items={privacy.ask.items}
                  onAnswer={privacy.answer}
                  onCancel={privacy.cancelAsk}
                />
              </div>
            ) : output || streaming ? (
              <ResultPanel
                markdown={shown}
                streaming={streaming}
                fill
                lang={outputLanguage}
                computed={
                  streaming ? null : computeResultNote(stage.output.computed, shown, outputLanguage)
                }
                quotes={docFiles ? foundQuotes : undefined}
                onQuote={docFiles ? showQuote : undefined}
              />
            ) : docFiles ? null : (
              <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                {fmt(t.tool.emptyResult, { action: t.tool.generate })}
              </div>
            )}
          </div>
          {resultContext && output && !streaming && !reviewing && (
            <div className="shrink-0">
              <ResultActions
                {...resultContext}
                generationId={generationId}
                courseId={courseId}
                itemId={itemId}
                asLesson={stage.courseExport === "lesson"}
              />
            </div>
          )}
          <ResultFooter
            markdown={shown}
            done={Boolean(output) && !streaming && !reviewing}
            saved={Boolean(generationId)}
            restored={Boolean(codes && output && !reviewing)}
            title={loc(tool.name, locale)}
            lang={outputLanguage}
            assistive={Boolean(tool.assistiveGrading)}
            copyHeading={stage.output.copyBlocks && loc(stage.output.copyBlocks, outputLanguage)}
          />
        </div>
      )}
    </FormResultLayout>
  );
}
