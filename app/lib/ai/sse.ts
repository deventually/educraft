/**
 * Bridge a provider's `AsyncIterable<string>` token stream into an HTTP
 * Server-Sent Events `ReadableStream`. Frames:
 *   data: {"t":"<chunk>"}\n\n        token delta
 *   event: done\ndata: {…}\n\n        normal completion (data = what onComplete returned, or {})
 *   event: error\ndata: {"message"}   error
 *   : keep-alive\n\n                 heartbeat (an SSE comment; clients ignore it)
 */

/**
 * A proxy drops a connection that carries no data for too long (Cloudflare: 100 s).
 * A model can think, or read a long document, for longer than that before its first
 * token, so the stream sends a comment well within that window.
 */
export const SSE_HEARTBEAT_MS = 15_000;

export interface SseOptions {
  /**
   * Called with the full concatenated text after a successful stream. What it returns
   * (e.g. `{ generationId }`, P27.1) becomes the data of the done frame.
   */
  onComplete?: (
    fullText: string,
  ) => undefined | Record<string, unknown> | Promise<undefined | Record<string, unknown>>;
  /** Map a thrown value to the user-facing message (e.g. localize it). */
  formatError?: (err: unknown) => string;
  /**
   * Always called exactly once when the stream settles — after normal completion
   * OR an error OR the reader closing. Use it to release resources (e.g. a rate
   * limiter's concurrency slot) regardless of how the stream ended.
   */
  onFinally?: () => void;
  /**
   * Called once when the reader goes away (the tab closed) before the stream ended.
   * Use it to abort the model call; what the source throws afterwards is ignored and
   * `onComplete` never runs.
   */
  onCancel?: () => void;
  /** Heartbeat interval; defaults to {@link SSE_HEARTBEAT_MS}. */
  heartbeatMs?: number;
}

export function sseStream(
  source: AsyncIterable<string>,
  opts: SseOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cancelled = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stopHeartbeat = () => {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    heartbeat = undefined;
  };
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // After a cancel the controller is closed; writing to it would throw.
      const send = (frame: string) => {
        if (!cancelled) controller.enqueue(encoder.encode(frame));
      };
      heartbeat = setInterval(() => send(": keep-alive\n\n"), opts.heartbeatMs ?? SSE_HEARTBEAT_MS);
      let full = "";
      try {
        for await (const chunk of source) {
          if (cancelled) break;
          if (chunk) {
            full += chunk;
            send(`data: ${JSON.stringify({ t: chunk })}\n\n`);
          }
        }
        if (!cancelled) {
          const meta = (opts.onComplete ? await opts.onComplete(full) : undefined) ?? {};
          send(`event: done\ndata: ${JSON.stringify(meta)}\n\n`);
        }
      } catch (err) {
        if (!cancelled) {
          const message = opts.formatError
            ? opts.formatError(err)
            : err instanceof Error
              ? err.message
              : String(err);
          send(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
        }
      } finally {
        stopHeartbeat();
        if (!cancelled) controller.close();
        opts.onFinally?.();
      }
    },
    cancel() {
      cancelled = true;
      stopHeartbeat();
      opts.onCancel?.();
    },
  });
}

/** A one-shot SSE stream that just emits an error frame (for setup failures). */
export function sseError(message: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`));
      controller.close();
    },
  });
}

export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable proxy buffering (nginx) so tokens flush immediately.
  "X-Accel-Buffering": "no",
};
