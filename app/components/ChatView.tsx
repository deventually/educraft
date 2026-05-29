import { useState, useRef, useEffect } from "react";
import { Send, Square, RotateCcw } from "lucide-react";
import type { Tool, ChatMessage } from "~/lib/registry/types";
import { DynamicForm, defaultValuesFor, type FormValues } from "./DynamicForm";
import { streamPost } from "~/lib/streamClient";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { Button, Label, Select } from "./ui";
import ReactMarkdown from "react-markdown";

interface Turn {
  role: "user" | "assistant";
  content: string;
  id: string;
  interrupted?: boolean;
}

interface ChatViewProps {
  tool: Tool;
  contextProfile?: { id: string } | null;
  defaultModel?: string;
  outputLanguage?: "nl" | "en";
  onGenerationStart?: () => void;
}

export function ChatView({
  tool,
  contextProfile,
  defaultModel,
  outputLanguage: defaultOutputLanguage,
  onGenerationStart,
}: ChatViewProps) {
  const t = useT();
  const locale = useLocale();
  const [sandboxValues, setSandboxValues] = useState<FormValues>(defaultValuesFor(tool.inputs));
  const [sandboxSubmitted, setSandboxSubmitted] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel || tool.defaultModel);
  const [outputLanguage, setOutputLanguage] = useState<"nl" | "en">(
    defaultOutputLanguage || tool.defaultOutputLanguage,
  );
  const threadRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const greeting = tool.chat?.greeting;
  const starters = tool.chat?.starters;

  // Auto-scroll the thread to the bottom whenever a new turn is added or
  // streamed into, so the latest output stays in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every turns change to follow streaming
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [turns]);

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
        },
        {
          onToken: (token: string) => {
            setTurns((prev) => {
              const updated = [...prev];
              const lastTurn = updated[updated.length - 1];
              if (lastTurn) {
                lastTurn.content += token;
              }
              return updated;
            });
          },
          onDone: () => {
            setIsStreaming(false);
          },
          onError: (error: string) => {
            console.error("Stream error:", error);
            setTurns((prev) => {
              const updated = [...prev];
              const lastTurn = updated[updated.length - 1];
              if (lastTurn) {
                lastTurn.interrupted = true;
              }
              return updated;
            });
            setIsStreaming(false);
          },
        },
        abortControllerRef.current.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Chat error:", err);
        setTurns((prev) => {
          const updated = [...prev];
          const lastTurn = updated[updated.length - 1];
          if (lastTurn) {
            lastTurn.interrupted = true;
          }
          return updated;
        });
      }
      setIsStreaming(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setTurns((prev) => {
      const updated = [...prev];
      const lastTurn = updated[updated.length - 1];
      if (lastTurn) {
        lastTurn.interrupted = true;
      }
      return updated;
    });
    setIsStreaming(false);
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

  return (
    <div className="flex flex-col gap-6">
      {/* Sandbox inputs (one-time) */}
      {!sandboxSubmitted && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
      )}

      {/* Simple controls (model, output language) */}
      {sandboxSubmitted && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="chat-model" className="mb-1.5">
              {t.tool.model}
            </Label>
            <Select
              id="chat-model"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              <option value="claude-sonnet-4-6">Claude Sonnet</option>
              <option value="claude-opus-4-7">Claude Opus</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="chat-lang" className="mb-1.5">
              {t.tool.outputLanguage}
            </Label>
            <Select
              id="chat-lang"
              value={outputLanguage}
              onChange={(e) => setOutputLanguage(e.target.value as "nl" | "en")}
            >
              <option value="nl">{t.tool.dutch}</option>
              <option value="en">{t.tool.english}</option>
            </Select>
          </div>
        </div>
      )}

      {/* Greeting and starters (on first load) */}
      {sandboxSubmitted && turns.length === 0 && greeting && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <p className="mb-3 text-slate-900">{loc(greeting, locale)}</p>
          {starters && starters.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {starters.map((starter) => (
                <button
                  key={loc(starter, locale)}
                  onClick={() => handleStarterClick(loc(starter, locale))}
                  className="rounded-full border border-violet-300 bg-white px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  {loc(starter, locale)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message thread */}
      {sandboxSubmitted && (
        <div
          ref={threadRef}
          className="flex max-h-96 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4"
          role="log"
          aria-live="polite"
          aria-label="Chat thread"
        >
          {turns.length === 0 ? (
            <p className="text-sm text-slate-500">
              {t.chat?.startConversation ||
                "Start the conversation by clicking a starter or typing a message."}
            </p>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex gap-2 ${turn.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex-1 rounded-lg px-3 py-2 text-sm ${
                    turn.role === "user"
                      ? "bg-violet-100 text-slate-900"
                      : "bg-white text-slate-800"
                  }`}
                >
                  {turn.content ? (
                    <ReactMarkdown className="prose prose-sm">{turn.content}</ReactMarkdown>
                  ) : (
                    <span className="italic text-slate-500">
                      {turn.interrupted ? (
                        t.chat?.interrupted || "Interrupted"
                      ) : (
                        <>
                          <span className="inline-block animate-pulse">●</span> {t.tool.generating}
                        </>
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Composer (message input) */}
      {sandboxSubmitted && (
        <div className="flex gap-2">
          <input
            type="text"
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
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:bg-slate-100"
          />

          {isStreaming ? (
            tool.chat?.allowStop && (
              <button
                onClick={handleStop}
                className="rounded-lg bg-red-500 p-2 text-white hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                title={t.tool.stop}
              >
                <Square className="size-4" />
              </button>
            )
          ) : (
            <>
              <button
                onClick={() => sendMessage()}
                disabled={!messageInput.trim() || isStreaming}
                className="rounded-lg bg-violet-600 p-2 text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:bg-slate-300"
                title={t.tool.generate}
              >
                <Send className="size-4" />
              </button>

              {tool.chat?.allowRegenerate && turns.length > 0 && (
                <button
                  onClick={handleRegenerate}
                  className="rounded-lg border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  title={t.tool.regenerate}
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
