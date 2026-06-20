import { useRef, useState } from "react";
import { Sparkles, Square, AlertTriangle } from "lucide-react";
import type { Tool, OutputLanguage } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import type { ImageInput } from "~/lib/ai/types";
import {
  DynamicForm,
  defaultValuesFor,
  missingRequired,
  profilePrefillValues,
  type FormValues,
} from "./DynamicForm";
import { toTemplateValues } from "~/lib/forms/values";
import { ToolControls, type PickerModel } from "./ToolControls";
import { ResultPanel } from "./ResultPanel";
import { Button } from "./ui";
import { streamPost } from "~/lib/streamClient";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";

interface Props {
  tool: Tool;
  profiles: ContextProfile[];
  defaultProfileId: string;
  localModels?: PickerModel[];
}

export function GeneratorView({ tool, profiles, defaultProfileId, localModels }: Props) {
  const t = useT();
  const locale = useLocale();
  const stage = tool.stages[0];
  const [values, setValues] = useState<FormValues>(() => ({
    ...defaultValuesFor(tool.inputs),
    // Derive any profile-backed fields (e.g. course level) from the default
    // profile so they aren't entered twice.
    ...profilePrefillValues(
      tool.inputs,
      profiles.find((p) => p.id === defaultProfileId),
    ),
  }));
  const [contextProfileId, setContextProfileId] = useState(defaultProfileId);

  // Switching the teaching context re-derives its profile-backed fields, while
  // leaving the rest of the form untouched. A field with no derived value (e.g.
  // a profile without a study year, or "no profile") resets to its empty
  // default, so a stale prefill never lingers.
  function selectProfile(id: string) {
    setContextProfileId(id);
    const prefill = profilePrefillValues(
      tool.inputs,
      profiles.find((p) => p.id === id),
    );
    setValues((prev) => {
      const next = { ...prev };
      for (const f of tool.inputs) {
        if (!f.prefillFromProfile) continue;
        next[f.name] = f.name in prefill ? prefill[f.name] : defaultValuesFor([f])[f.name];
      }
      return next;
    });
  }
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(tool.defaultOutputLanguage);
  const [model, setModel] = useState(tool.defaultModel);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Check if tool has image inputs
  const hasImageInputs = tool.inputs.some((f) => f.kind === "image");

  async function generate() {
    const missing = missingRequired(tool.inputs, values);
    if (missing.length) {
      setError(`${t.tool.required}: ${missing.map((f) => loc(f.label, locale)).join(", ")}`);
      return;
    }
    setError(null);
    setOutput("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Extract images from form values if present
    const images: ImageInput[] = [];
    for (const field of tool.inputs) {
      if (field.kind === "image") {
        const fieldImages = values[field.name];
        if (
          Array.isArray(fieldImages) &&
          fieldImages.length > 0 &&
          typeof fieldImages[0] === "object"
        ) {
          images.push(...(fieldImages as ImageInput[]));
        }
      }
    }

    // Image fields are sent separately (above); drop them from the prompt values.
    const valuesToSend = toTemplateValues(values);

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
      },
      {
        onToken: (text) => setOutput((prev) => prev + text),
        onDone: () => setStreaming(false),
        onError: (msg) => {
          setError(msg);
          setStreaming(false);
        },
      },
      ctrl.signal,
    );
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
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
          disabled={streaming}
          requiresImages={hasImageInputs}
        />
        <DynamicForm
          fields={tool.inputs}
          values={values}
          onChange={(name, value) => setValues((prev) => ({ ...prev, [name]: value }))}
        />
        <div className="flex items-center gap-3">
          {streaming ? (
            <Button variant="secondary" onClick={stop}>
              <Square className="size-4" /> {t.tool.stop}
            </Button>
          ) : (
            <Button onClick={generate}>
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
      </div>

      <div className="min-w-0 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:self-start">
        {output || streaming ? (
          <ResultPanel
            markdown={output}
            filenameBase={`${tool.slug}-${String(values.onderwerp ?? values.discipline ?? "")}`}
            streaming={streaming}
            fill
          />
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-400">
            {fmt(t.tool.emptyResult, { action: t.tool.generate })}
          </div>
        )}
      </div>
    </div>
  );
}
