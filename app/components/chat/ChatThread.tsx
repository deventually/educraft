import { useEffect, useRef, type ReactNode } from "react";
import type { Tool } from "~/lib/registry/types";
import type { Turn } from "~/lib/chat/turns";
import { useT } from "~/lib/i18n/useT";
import { Markdown } from "../Markdown";
import { ReadAloudButton } from "../ReadAloudButton";
import { ToolIcon } from "../ToolIcon";

/** Renders an answer itself; `undefined` falls back to Markdown (see `ChatView`). */
export type RenderAssistant = (
  content: string,
  ctx: { streaming: boolean; userTurns: string[]; model: string },
) => ReactNode | undefined;

interface ChatThreadProps {
  tool: Tool;
  turns: Turn[];
  isStreaming: boolean;
  /** The greeting in the output language, placeholders filled; empty for none. */
  greeting: string;
  /** Starter prompts in the output language. */
  starters: string[];
  onStarter: (starter: string) => void;
  outputLanguage: "nl" | "en";
  model: string;
  renderAssistant?: RenderAssistant;
  /** Shown below the turns (next steps), e.g. `ResultActions` once the reply is saved. */
  footer?: ReactNode;
}

/**
 * The message thread: a centred welcome with starters while it is empty, then the turns.
 * On wide screens it is the scroll region that fills the available height.
 */
export function ChatThread({
  tool,
  turns,
  isStreaming,
  greeting,
  starters,
  onStarter,
  outputLanguage,
  model,
  renderAssistant,
  footer,
}: ChatThreadProps) {
  const t = useT();
  const endRef = useRef<HTMLDivElement>(null);
  const userTurns = turns.filter((x) => x.role === "user").map((x) => x.content);

  // Keep the latest output in view whenever a turn is added or streamed into.
  // Scrolling an end anchor into view follows whichever element actually
  // scrolls — the thread on wide screens, the page on mobile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every turns change to follow streaming
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  return (
    <div
      className="md:min-h-0 md:flex-1 md:overflow-y-auto"
      role="log"
      aria-live="polite"
      aria-label={t.chat.threadLabel}
    >
      {turns.length === 0 ? (
        // Centered welcome, like a fresh chat — greeting + starter prompts.
        <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 py-10 text-center md:h-full md:min-h-0">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
            <ToolIcon name={tool.icon} className="size-7" />
          </span>
          {greeting ? (
            <p className="max-w-xl text-lg leading-relaxed text-slate-700">{greeting}</p>
          ) : (
            <p className="text-sm text-slate-500">{t.chat.startConversation}</p>
          )}
          {starters.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  onClick={() => onStarter(starter)}
                  className="rounded-full border border-violet-300 bg-white px-4 py-2 text-sm text-violet-700 transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
          {turns.map((turn, i) => {
            if (turn.role === "user") {
              return (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white">
                    {turn.content}
                  </div>
                </div>
              );
            }
            const streaming = isStreaming && i === turns.length - 1;
            return (
              <div key={turn.id} className="flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <ToolIcon name={tool.icon} className="size-4" />
                </span>
                <div className="min-w-0 flex-1 text-sm text-slate-800">
                  {turn.content ? (
                    <>
                      {renderAssistant?.(turn.content, { streaming, userTurns, model }) ?? (
                        <Markdown>{turn.content}</Markdown>
                      )}
                      {!streaming && (
                        <div className="mt-1 -ml-3">
                          <ReadAloudButton text={turn.content} lang={outputLanguage} />
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="italic text-slate-500">
                      {turn.interrupted ? (
                        t.chat.interrupted
                      ) : (
                        <>
                          <span className="inline-block animate-pulse">●</span> {t.tool.generating}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {footer}
          {/* Anchor the auto-scroll: scrolls the thread (md+) or the page
              (mobile) so the latest turn stays in view while streaming. */}
          <div ref={endRef} aria-hidden />
        </div>
      )}
    </div>
  );
}
