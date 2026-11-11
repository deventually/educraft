import { useRef, useState } from "react";
import type { ChatMessage } from "~/lib/registry/types";
import { streamPost } from "~/lib/streamClient";
import { useStreamAborts } from "~/lib/hooks/useStreamAborts";
import { appendTokenToLastTurn, markLastTurnInterrupted, type Turn } from "~/lib/chat/turns";

/** Stable id grouping every turn of one chat into a single saved project. */
function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ChatSessionOptions {
  /**
   * The /api/stream fields of this render (tool, values, model, …), without `messages` and
   * `sessionId`, which the session adds itself.
   */
  body: Record<string, unknown>;
  onGenerationStart?: () => void;
}

/**
 * One chat conversation: its turns, the stream into the last one, stop and regenerate.
 * Every turn shares one session id, so each reply updates the same saved project.
 */
export function useChatSession({ body, onGenerationStart }: ChatSessionOptions) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const streams = useStreamAborts(isStreaming);
  // One id for the whole conversation, so each turn updates the same project.
  const sessionIdRef = useRef<string | null>(null);
  if (sessionIdRef.current === null) sessionIdRef.current = newSessionId();
  // The saved conversation (its id is the session id), once a reply is stored (P27.1).
  const [savedId, setSavedId] = useState<string | null>(null);

  /** Sends `message`; the caller has checked it is not empty and nothing is streaming. */
  const send = async (message: string) => {
    // Create user turn
    const userTurn: Turn = { role: "user", content: message, id: `user-${Date.now()}` };
    // Create empty assistant turn
    const assistantTurn: Turn = { role: "assistant", content: "", id: `assistant-${Date.now()}` };

    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setIsStreaming(true);

    onGenerationStart?.();

    try {
      // Build message history for the API
      const messageHistory: ChatMessage[] = turns
        .filter((t) => t.content && !t.interrupted)
        .map((t) => ({ role: t.role, content: t.content }));

      // Add the new user message
      messageHistory.push({ role: "user", content: message });

      const signal = streams.start();

      await streamPost(
        "/api/stream",
        { ...body, messages: messageHistory, sessionId: sessionIdRef.current },
        {
          onToken: (token: string) => {
            setTurns((prev) => appendTokenToLastTurn(prev, token));
          },
          onDone: (meta) => {
            if (meta?.generationId) setSavedId(meta?.generationId);
            setIsStreaming(false);
          },
          onError: (error) => {
            // The thread marks the turn interrupted rather than rendering the
            // message inline; log the server message or the machine code.
            console.error("Stream error:", error.message ?? error.code);
            setTurns((prev) => markLastTurnInterrupted(prev));
            setIsStreaming(false);
          },
        },
        signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Chat error:", err);
        setTurns((prev) => markLastTurnInterrupted(prev));
      }
      setIsStreaming(false);
    }
  };

  const stop = () => {
    streams.abort();
    setTurns((prev) => markLastTurnInterrupted(prev));
    setIsStreaming(false);
  };

  /** Drops the last answer; returns the user message to send again, if any. */
  const dropLastAnswer = (): string | undefined => {
    if (turns.length < 2) return undefined;
    // Remove last assistant turn
    setTurns((prev) => prev.slice(0, -1));
    setIsStreaming(false);
    return [...turns].reverse().find((t) => t.role === "user")?.content;
  };

  return { turns, isStreaming, savedId, send, stop, dropLastAnswer };
}
