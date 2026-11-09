import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { RotateCcw, Send, Square } from "lucide-react";
import type { Tool } from "~/lib/registry/types";
import { useT } from "~/lib/i18n/useT";
import { appendDictation } from "~/lib/speech/dictation";
import { AiNotice } from "../AiNotice";
import { DictateButton } from "../DictateButton";

interface ChatComposerProps {
  tool: Tool;
  value: string;
  onChange: Dispatch<SetStateAction<string>>;
  onSend: (message?: string) => void;
  onStop: () => void;
  onRegenerate: () => void;
  isStreaming: boolean;
  /** Whether the conversation has turns: quick replies and regenerate need one. */
  hasTurns: boolean;
  /** Fixed replies in the output language. */
  quickReplies: string[];
  outputLanguage: "nl" | "en";
}

/** The composer, pinned to the bottom of the chat column: notice, quick replies, input, actions. */
export function ChatComposer({
  tool,
  value,
  onChange,
  onSend,
  onStop,
  onRegenerate,
  isStreaming,
  hasTurns,
  quickReplies,
  outputLanguage,
}: ChatComposerProps) {
  const t = useT();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Grow the composer textarea with its content (single line → up to ~8 lines),
  // then scroll internally — the bottom-pinned input never pushes the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every input change to resize
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  return (
    <div className="flex-none pt-3">
      <div className="mx-auto w-full max-w-3xl">
        {/* Persistent AI-transparency notice above the composer. */}
        <AiNotice variant={tool.assistiveGrading ? "assistive" : "generic"} className="mb-2" />
        {/* Fixed replies (P29.3), once the conversation runs: real buttons, so the
            keyboard reaches them as well as the composer. */}
        {hasTurns && !isStreaming && quickReplies.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => onSend(reply)}
                className="rounded-full border border-violet-300 bg-white px-4 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500">
          <textarea
            ref={inputRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={t.chat.inputPlaceholder}
            disabled={isStreaming}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed placeholder-slate-500 focus:outline-none disabled:opacity-60"
          />

          {isStreaming ? (
            tool.chat?.allowStop && (
              <button
                onClick={onStop}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                title={t.tool.stop}
              >
                <Square className="size-4" />
              </button>
            )
          ) : (
            <>
              <DictateButton
                lang={outputLanguage}
                className="size-9 rounded-xl"
                onText={(text) => {
                  onChange((cur) => appendDictation(cur, text));
                  inputRef.current?.focus();
                }}
              />
              {tool.chat?.allowRegenerate && hasTurns && (
                <button
                  onClick={onRegenerate}
                  className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  title={t.tool.regenerate}
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              <button
                onClick={() => onSend()}
                disabled={!value.trim() || isStreaming}
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-slate-300"
                title={t.tool.generate}
              >
                <Send className="size-4" />
              </button>
            </>
          )}
        </div>
        <p className="mt-1.5 px-2 text-center text-[11px] text-slate-500">{t.chat.enterHint}</p>
      </div>
    </div>
  );
}
