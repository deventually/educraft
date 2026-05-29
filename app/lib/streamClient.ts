/**
 * POST a payload to an SSE endpoint and consume the streamed token frames.
 * Uses fetch + ReadableStream (not EventSource, which is GET-only) so we can
 * send a JSON body and abort via AbortController.
 */
export interface StreamHandlers {
  onToken: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
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
    handlers.onError?.((err as Error).message);
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`HTTP ${res.status}`);
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
          try {
            handlers.onError?.(JSON.parse(data).message ?? "Onbekende fout");
          } catch {
            handlers.onError?.("Onbekende fout");
          }
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
    handlers.onError?.((err as Error).message);
  }
}
