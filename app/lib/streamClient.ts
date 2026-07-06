/**
 * POST a payload to an SSE endpoint and consume the streamed token frames.
 * Uses fetch + ReadableStream (not EventSource, which is GET-only) so we can
 * send a JSON body and abort via AbortController.
 */
/**
 * A stream failure. Either the server sent an already-localized `message` (its
 * SSE error frame), or the failure is client-side and carries only a machine
 * `code` — the caller (which holds `useT`) maps a code to `m.error.unknown`. The
 * client never invents human-readable copy (Phase 5.3).
 */
export type StreamErrorCode = "network" | "http" | "parse";

export interface StreamError {
  /** Localized message from the server's error frame, when present. */
  message?: string;
  /** Machine code for a client-side failure; the caller localizes it. */
  code?: StreamErrorCode;
  /** HTTP status, for a `"http"` code (diagnostics only). */
  status?: number;
}

export interface StreamHandlers {
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (error: StreamError) => void;
}

export async function streamPost(
  url: string,
  payload: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError?.({ code: "network" });
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.({ code: "http", status: res.status });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const lines = frame.split("\n");
        let event = "message";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) event = line.slice(7).trim();
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        if (event === "error") {
          // The server's error frame carries an already-localized message; pass
          // it through. If it is missing/unparseable, surface a machine code and
          // let the caller localize — never invent copy here.
          let message: string | undefined;
          try {
            const parsed = JSON.parse(data) as { message?: unknown };
            if (typeof parsed.message === "string") message = parsed.message;
          } catch {
            /* not JSON — fall through to the parse code */
          }
          handlers.onError?.(message ? { message } : { code: "parse" });
          return;
        }
        if (event === "done") {
          handlers.onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.t) handlers.onToken(parsed.t);
        } catch {
          /* ignore malformed frame */
        }
      }
    }
    handlers.onDone?.();
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError?.({ code: "network" });
  }
}
