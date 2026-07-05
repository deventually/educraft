import { useState, useRef, useEffect } from "react";
import { Send, Square, RotateCcw, Pencil } from "lucide-react";
import type { Tool, ChatMessage } from "~/lib/registry/types";
import { DynamicForm, defaultValuesFor, type FormValues } from "./DynamicForm";
import { summarizeSandbox } from "~/lib/forms/summarize";
import { streamPost } from "~/lib/streamClient";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { Button, Label, Select } from "./ui";
import { pickableModels, type PickerModel } from "~/lib/ai/models";
import { appendTokenToLastTurn, markLastTurnInterrupted, type Turn } from "~/lib/chat/turns";
import { interpolateGreeting } from "~/lib/chat/greeting";
import type { TemplateValues } from "~/lib/template/interpolate";
import { Markdown } from "./Markdown";
import { ToolIcon } from "./ToolIcon";
import { AiNotice } from "./AiNotice";
import { SessionHelpfulness } from "./SessionHelpfulness";

/** Stable id grouping every turn of one chat into a single saved project. */
function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ChatViewProps {
  tool: Tool;
  contextProfile?: { id: string } | null;
  defaultModel?: string;
  outputLanguage?: "nl" | "en";
  /** Local models discovered at runtime (Ollama / LM Studio), appended to the catalog. */
  localModels?: PickerModel[];
  /**
   * Provisioned-student mode (Phase 6.9): the sandbox is prefilled + locked from
   * the cohort config, so the student skips the sandbox gate and the editable
   * settings/profile controls and lands directly on the greeting. `undefined` for
   * teachers/admins, who keep the editable sandbox.
   */
  lockedValues?: Record<string, string>;
  onGenerationStart?: () => void;
}

export function ChatView({
  tool,
  contextProfile,
  defaultModel,
  outputLanguage: defaultOutputLanguage,
  localModels,
  lockedValues,
  onGenerationStart,
}: ChatViewProps) {
  const t = useT();
  const locale = useLocale();
  const locked = lockedValues != null;
  const [sandboxValues, setSandboxValues] = useState<FormValues>(
    locked ? { ...defaultValuesFor(tool.inputs), ...lockedValues } : defaultValuesFor(tool.inputs),
  );
  // Provisioned students skip the sandbox gate entirely (locked ⇒ pre-submitted).
  const [sandboxSubmitted, setSandboxSubmitted] = useState(locked);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  // End-of-session self-report + summariser trigger (Phase 7). `ending` reveals
  // the helpfulness control (which shows its own post-rating confirmation).
  const [ending, setEnding] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel || tool.defaultModel);
  // The conversation defaults to the interface language: a Dutch UI opens a
  // Dutch chat, an English UI an English one. An explicit prop still wins.
  const [outputLanguage, setOutputLanguage] = useState<"nl" | "en">(
    defaultOutputLanguage || locale,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // One id for the whole conversation, so each turn updates the same project.
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) sessionIdRef.current = newSessionId();

  const greeting = tool.chat?.greeting;
  const starters = tool.chat?.starters;
  // Every screen offers the same models: API-key catalog + local CLI agents +
  // any Ollama / LM Studio models discovered at runtime.
  const modelOptions = pickableModels(localModels ?? []);

  // Keep the latest output in view whenever a turn is added or streamed into.
  // Scrolling an end anchor into view follows whichever element actually
  // scrolls — the thread on wide screens, the page on mobile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every turns change to follow streaming
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns]);

  // Grow the composer textarea with its content (single line → up to ~8 lines),
  // then scroll internally — the bottom-pinned input never pushes the page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every input change to resize
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [messageInput]);

  const handleSandboxSubmit = () => {
    setSandboxSubmitted(true);
  };

  const handleStarterClick = (starter: string) => {
    if (!sandboxSubmitted) {
      handleSandboxSubmit();
      setTimeout(() => sendMessage(starter), 100);
    } else {
      sendMessage(starter);
    }
  };

  const sendMessage = async (message: string = messageInput) => {
    if (!message.trim() || isStreaming) return;

    // Create user turn
    const userTurnId = `user-${Date.now()}`;
    const userTurn: Turn = {
      role: "user",
      content: message,
      id: userTurnId,
    };

    // Create empty assistant turn
    const assistantTurnId = `assistant-${Date.now()}`;
    const assistantTurn: Turn = {
      role: "assistant",
      content: "",
      id: assistantTurnId,
    };

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setMessageInput("");
    setIsStreaming(true);

    onGenerationStart?.();

    try {
      // Build message history for the API
      const messageHistory: ChatMessage[] = turns
        .filter((t) => t.content && !t.interrupted)
        .map((t) => ({
          role: t.role,
          content: t.content,
        }));

      // Add the new user message
      messageHistory.push({ role: "user", content: message });

      abortControllerRef.current = new AbortController();

      await streamPost(
        "/api/stream",
        {
          slug: tool.slug,
          stageId: tool.stages[0]?.id,
          values: sandboxValues,
          contextProfileId: contextProfile?.id || null,
          outputLanguage,
          model: selectedModel,
          messages: messageHistory,
          sessionId: sessionIdRef.current,
        },
        {
          onToken: (token: string) => {
            setTurns((prev) => appendTokenToLastTurn(prev, token));
          },
          onDone: () => {
            setIsStreaming(false);
          },
          onError: (error: string) => {
            console.error("Stream error:", error);
            setTurns((prev) => markLastTurnInterrupted(prev));
            setIsStreaming(false);
          },
        },
        abortControllerRef.current.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Chat error:", err);
        setTurns((prev) => markLastTurnInterrupted(prev));
      }
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setTurns((prev) => markLastTurnInterrupted(prev));
    setIsStreaming(false);
  };

  // Close the session: fire-and-forget the summariser + optional self-report.
  // Best-effort — a failed close never blocks the student from leaving.
  const closeSession = (helpfulness: number | null) => {
    void fetch("/api/session-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionIdRef.current, helpfulness }),
    }).catch(() => {});
  };

  const handleEndSession = () => {
    setEnding(true);
    // The click itself is the explicit close: run the summary now, even if the
    // student never picks a rating.
    closeSession(null);
  };

  const handleRegenerate = () => {
    if (turns.length < 2) return;

    // Remove last assistant turn
    setTurns((prev) => prev.slice(0, -1));
    setIsStreaming(false);

    // Re-send the last user message
    const lastUserTurn = [...turns].reverse().find((t) => t.role === "user");
    if (lastUserTurn) {
      setTimeout(() => sendMessage(lastUserTurn.content), 100);
    }
  };

  // Sandbox gate: a focused card the user fills once before the chat opens.
  if (!sandboxSubmitted) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900">{t.tool.contextProfile}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {t.chat?.sandboxHint || "Fill in the details below. These inputs are used once."}
            </p>
          </div>
          <DynamicForm
            fields={tool.inputs}
            values={sandboxValues}
            onChange={(name, value) => setSandboxValues((prev) => ({ ...prev, [name]: value }))}
          />
          <Button onClick={handleSandboxSubmit} className="mt-4">
            {t.chat?.continue || "Continue"}
          </Button>
        </div>
      </div>
    );
  }

  // Greeting and starters are conversation content, so they follow the output
  // language (the aside's "Taal van uitvoer") — switching it re-renders them at
  // once and keeps them consistent with the language the model replies in. UI
  // chrome (labels, buttons) stays in the interface `locale`.
  const greetingText = greeting
    ? interpolateGreeting(
        loc(greeting, outputLanguage),
        // Sandbox values supply greeting placeholders like {{subject}};
        // image fields are irrelevant to greetings, hence the cast.
        sandboxValues as unknown as TemplateValues,
      )
    : "";
  const isEmpty = turns.length === 0;
  // What the user entered in the one-time sandbox, shown so the chat makes clear
  // which settings (e.g. which theorist) it's running with.
  const sandboxSummary = summarizeSandbox(tool.inputs, sandboxValues, locale);

  return (
    // Two-pane chat. On a wide screen it's a fixed-height layout: the aside sits
    // on the right, and the chat column's thread scrolls internally so the
    // composer stays pinned. On mobile it collapses to a single column (aside on
    // top) that scrolls with the page — pinning there would trap the tall aside
    // and its model/language controls off-screen.
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:flex-row md:gap-6">
      {/* Settings aside — what was entered before the chat, plus model/language.
          Hidden for a provisioned student: the teacher set the config, so there
          are no editable settings/profile controls (Phase 6.9). */}
      {!locked && (
        <aside
          aria-labelledby="chat-settings-heading"
          className="flex-none rounded-2xl border border-slate-200 bg-white p-4 md:order-last md:w-72 md:overflow-y-auto"
        >
          <h2
            id="chat-settings-heading"
            className="text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {t.chat?.yourSettings || "Your settings"}
          </h2>

          {sandboxSummary.length > 0 && (
            <dl className="mt-3 space-y-2.5">
              {sandboxSummary.map((item) => (
                <div key={item.name}>
                  <dt className="text-[11px] text-slate-500">{item.label}</dt>
                  <dd className="text-sm font-medium text-slate-800">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {tool.inputs.length > 0 && (
            <button
              type="button"
              onClick={() => setSandboxSubmitted(false)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Pencil className="size-3.5" aria-hidden />
              {t.chat?.edit || "Edit"}
            </button>
          )}

          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            <div>
              <Label htmlFor="chat-model" className="mb-1 text-[11px] text-slate-500">
                {t.tool.model}
              </Label>
              <Select
                id="chat-model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="h-9 w-full py-0 text-sm"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="chat-lang" className="mb-1 text-[11px] text-slate-500">
                {t.tool.outputLanguage}
              </Label>
              <Select
                id="chat-lang"
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value as "nl" | "en")}
                className="h-9 w-full py-0 text-sm"
              >
                <option value="nl">{t.tool.dutch}</option>
                <option value="en">{t.tool.english}</option>
              </Select>
            </div>
          </div>
        </aside>
      )}

      {/* Chat column — on wide screens the thread fills the height and the
          composer pins; on mobile it flows in the page scroll. */}
      <div className="flex flex-col md:min-h-0 md:flex-1">
        {/* Provisioned student: a compact read-only line naming the teacher's
            config, for transparency (no editable controls). */}
        {locked && sandboxSummary.length > 0 && (
          <p className="mb-2 flex-none text-xs text-slate-500">
            <span className="font-medium text-slate-600">
              {t.chat?.provisionedFor || "Set up for you"}:
            </span>{" "}
            {sandboxSummary.map((item) => item.value).join(" · ")}
          </p>
        )}
        {/* Message thread — the scroll region that fills the available height (md+) */}
        <div
          className="md:min-h-0 md:flex-1 md:overflow-y-auto"
          role="log"
          aria-live="polite"
          aria-label="Chat thread"
        >
          {isEmpty ? (
            // Centered welcome, like a fresh chat — greeting + starter prompts.
            <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 py-10 text-center md:h-full md:min-h-0">
              <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600">
                <ToolIcon name={tool.icon} className="size-7" />
              </span>
              {greetingText ? (
                <p className="max-w-xl text-lg leading-relaxed text-slate-700">{greetingText}</p>
              ) : (
                <p className="text-sm text-slate-500">
                  {t.chat?.startConversation ||
                    "Start the conversation by clicking a starter or typing a message."}
                </p>
              )}
              {starters && starters.length > 0 && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {starters.map((starter) => (
                    <button
                      key={loc(starter, outputLanguage)}
                      onClick={() => handleStarterClick(loc(starter, outputLanguage))}
                      className="rounded-full border border-violet-300 bg-white px-4 py-2 text-sm text-violet-700 transition-colors hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      {loc(starter, outputLanguage)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
              {turns.map((turn) =>
                turn.role === "user" ? (
                  <div key={turn.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-violet-600 px-4 py-2.5 text-sm leading-relaxed text-white">
                      {turn.content}
                    </div>
                  </div>
                ) : (
                  <div key={turn.id} className="flex gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                      <ToolIcon name={tool.icon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-sm text-slate-800">
                      {turn.content ? (
                        <Markdown>{turn.content}</Markdown>
                      ) : (
                        <span className="italic text-slate-500">
                          {turn.interrupted ? (
                            t.chat?.interrupted || "Interrupted"
                          ) : (
                            <>
                              <span className="inline-block animate-pulse">●</span>{" "}
                              {t.tool.generating}
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
              {/* Anchor the auto-scroll: scrolls the thread (md+) or the page
                  (mobile) so the latest turn stays in view while streaming. */}
              <div ref={endRef} aria-hidden />
            </div>
          )}
        </div>

        {/* Composer — pinned to the bottom of the chat column */}
        <div className="flex-none pt-3">
          <div className="mx-auto w-full max-w-3xl">
            {/* Persistent AI-transparency notice above the composer. */}
            <AiNotice variant={tool.assistiveGrading ? "assistive" : "generic"} className="mb-2" />
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500">
              <textarea
                ref={inputRef}
                rows={1}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t.chat?.inputPlaceholder || "Your message…"}
                disabled={isStreaming}
                className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed placeholder-slate-400 focus:outline-none disabled:opacity-60"
              />

              {isStreaming ? (
                tool.chat?.allowStop && (
                  <button
                    onClick={handleStop}
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-500 text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    title={t.tool.stop}
                  >
                    <Square className="size-4" />
                  </button>
                )
              ) : (
                <>
                  {tool.chat?.allowRegenerate && turns.length > 0 && (
                    <button
                      onClick={handleRegenerate}
                      className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      title={t.tool.regenerate}
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={() => sendMessage()}
                    disabled={!messageInput.trim() || isStreaming}
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-slate-300"
                    title={t.tool.generate}
                  >
                    <Send className="size-4" />
                  </button>
                </>
              )}
            </div>
            <p className="mt-1.5 px-2 text-center text-[11px] text-slate-400">
              {t.chat?.enterHint || "Enter to send · Shift+Enter for a new line"}
            </p>

            {/* End-of-session self-report (Phase 7). Offered once the chat has
                content; picking a rating (or ending) triggers the de-personalised
                summariser and records the student's optional helpfulness signal. */}
            {turns.length > 0 && !ending && !isStreaming && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleEndSession}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {t.chat?.endSession || "End session"}
                </button>
              </div>
            )}
            {ending && (
              <SessionHelpfulness className="mt-3" onSubmit={(value) => closeSession(value)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
