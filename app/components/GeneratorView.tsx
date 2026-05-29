import { useRef, useState } from "react";
import { Sparkles, Square, AlertTriangle } from "lucide-react";
import type { Tool, OutputLanguage } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
import { DynamicForm, defaultValuesFor, missingRequired, type FormValues } from "./DynamicForm";
import { ToolControls } from "./ToolControls";
import { ResultPanel } from "./ResultPanel";
import { Button } from "./ui";
import { streamPost } from "~/lib/streamClient";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

interface Props {
  tool: Tool;
  profiles: ContextProfile[];
  defaultProfileId: string;
}

export function GeneratorView({ tool, profiles, defaultProfileId }: Props) {
  const t = useT();
  const stage = tool.stages[0];
  const [values, setValues] = useState<FormValues>(() => defaultValuesFor(tool.inputs));
  const [contextProfileId, setContextProfileId] = useState(defaultProfileId);
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>(tool.defaultOutputLanguage);
  const [model, setModel] = useState(tool.defaultModel);
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    const missing = missingRequired(tool.inputs, values);
    if (missing.length) {
      setError(`${t.tool.required}: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    setOutput("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    await streamPost(
      "/api/stream",
      { slug: tool.slug, stageId: stage.id, values, contextProfileId, outputLanguage, model },
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
          onProfile={setContextProfileId}
          outputLanguage={outputLanguage}
          onLanguage={setOutputLanguage}
          model={model}
          onModel={setModel}
          disabled={streaming}
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

      <div className="min-w-0">
        {output || streaming ? (
          <ResultPanel
            markdown={output}
            filenameBase={`${tool.slug}-${String(values.onderwerp ?? values.discipline ?? "")}`}
            streaming={streaming}
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
