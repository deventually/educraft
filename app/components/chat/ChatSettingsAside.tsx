import { Copy, Pencil } from "lucide-react";
import { Link } from "react-router";
import type { Tool } from "~/lib/registry/types";
import type { FormValues } from "~/lib/forms/values";
import type { PickerModel } from "~/lib/ai/models";
import { useT } from "~/lib/i18n/useT";
import { fillStudentPrompt } from "~/lib/chat/studentPrompt";
import { AdvancedSettings } from "../AdvancedSettings";
import { useToast } from "../Toast";
import { Label, Select } from "../ui";

/** The model choice behind "Advanced": which model, and its reasoning switch if it has one. */
interface ModelChoice {
  options: PickerModel[];
  selected: string;
  onSelect: (id: string) => void;
  supportsThinking: boolean;
  thinking: boolean;
  onThinking: (on: boolean) => void;
}

interface ChatSettingsAsideProps {
  tool: Tool;
  /** What the user entered before the chat, shown so it is clear which settings it runs with. */
  summary: { name: string; label: string; value: string }[];
  /** Reopens the setup card; omitted when the values were chosen on the page itself. */
  onEdit?: () => void;
  values: FormValues;
  studentPrompt?: Record<"nl" | "en", string>;
  hasContextProfile: boolean;
  outputLanguage: "nl" | "en";
  onOutputLanguage: (lang: "nl" | "en") => void;
  model: ModelChoice;
}

/**
 * Settings aside: what was entered before the chat, the output language, and the technique
 * (model, reasoning) behind "Advanced".
 */
export function ChatSettingsAside({
  tool,
  summary,
  onEdit,
  values,
  studentPrompt,
  hasContextProfile,
  outputLanguage,
  onOutputLanguage,
  model,
}: ChatSettingsAsideProps) {
  const t = useT();
  const { showToast } = useToast();
  const selectedName = model.options.find((m) => m.id === model.selected)?.displayName;

  return (
    <aside
      aria-labelledby="chat-settings-heading"
      className="flex-none rounded-2xl border border-slate-200 bg-white p-4 md:order-last md:w-72 md:overflow-y-auto"
    >
      <h2
        id="chat-settings-heading"
        className="text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        {t.chat.yourSettings}
      </h2>

      {summary.length > 0 && (
        <dl className="mt-3 space-y-2.5">
          {summary.map((item) => (
            <div key={item.name}>
              <dt className="text-[11px] text-slate-500">{item.label}</dt>
              <dd className="text-sm font-medium text-slate-800">{item.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Pencil className="size-3.5" aria-hidden />
          {t.chat.edit}
        </button>
      )}

      {tool.copyableStudentPrompt && studentPrompt && (
        <div className="mt-3">
          <button
            type="button"
            aria-describedby="chat-copy-students-hint"
            onClick={() => {
              const text = fillStudentPrompt(
                studentPrompt[outputLanguage],
                tool.inputs,
                values as Record<string, unknown>,
              );
              (navigator.clipboard?.writeText(text) ?? Promise.reject()).then(
                () => showToast({ variant: "success", message: t.chat.copiedForStudents }),
                () => showToast({ variant: "error", message: t.chat.copyFailed }),
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <Copy className="size-3.5" aria-hidden />
            {t.chat.copyForStudents}
          </button>
          <p id="chat-copy-students-hint" className="mt-1 text-xs text-slate-600">
            {t.chat.copyForStudentsHint}
          </p>
        </div>
      )}

      {tool.usesContextProfile && !hasContextProfile && (
        <p className="mt-3 text-xs text-slate-600">
          {t.chat.noProfileHint}{" "}
          <Link
            to="/context-profiles"
            className="font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            {t.tool.noProfileAction}
          </Link>
        </p>
      )}

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        {/* Output language is not technique: it stays visible. */}
        <div>
          <Label htmlFor="chat-lang" className="mb-1 text-[11px] text-slate-500">
            {t.tool.outputLanguage}
          </Label>
          <Select
            id="chat-lang"
            value={outputLanguage}
            onChange={(e) => onOutputLanguage(e.target.value as "nl" | "en")}
            className="h-9 w-full py-0 text-sm"
          >
            <option value="nl">{t.tool.dutch}</option>
            <option value="en">{t.tool.english}</option>
          </Select>
        </div>
        {/* Technique (model, reasoning) sits behind "Advanced". With one model and
            no reasoning switch there is nothing to choose, so it drops out. */}
        {(model.options.length > 1 || model.supportsThinking) && (
          <AdvancedSettings current={selectedName ?? model.selected}>
            {model.options.length > 1 && (
              <div>
                <Label htmlFor="chat-model" className="mb-1 text-[11px] text-slate-500">
                  {t.tool.model}
                </Label>
                <Select
                  id="chat-model"
                  value={model.selected}
                  onChange={(e) => model.onSelect(e.target.value)}
                  className="h-9 w-full py-0 text-sm"
                >
                  {model.options.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.displayName}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {/* Reasoning switch: only for models that support it (Ollama Qwen3
                etc.). Off by default: a direct answer is far faster than
                reasoning first. */}
            {model.supportsThinking && (
              <div>
                <label
                  htmlFor="chat-thinking"
                  className="flex items-center gap-2 text-sm text-slate-700"
                >
                  <input
                    id="chat-thinking"
                    type="checkbox"
                    className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    checked={model.thinking}
                    onChange={(e) => model.onThinking(e.target.checked)}
                  />
                  {t.tool.reasoning}
                </label>
                <p className="mt-1 text-[11px] text-slate-500">{t.tool.reasoningHint}</p>
              </div>
            )}
          </AdvancedSettings>
        )}
      </div>
    </aside>
  );
}
