/**
 * Bridge a provider's `AsyncIterable<string>` token stream into an HTTP
 * Server-Sent Events `ReadableStream`. Frames:
 *   data: {"t":"<chunk>"}\n\n        token delta
 *   event: done\ndata: {}\n\n         normal completion
 *   event: error\ndata: {"message"}   error
 */
export interface SseOptions {
  /** Called with the full concatenated text after a successful stream. */
  onComplete?: (fullText: string) => void | Promise<void>;
  /** Map a thrown value to the user-facing message (e.g. localize it). */
  formatError?: (err: unknown) => string;
}

export function sseStream(
  source: AsyncIterable<string>,
  opts: SseOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of source) {
          if (chunk) {
            full += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ t: chunk })}\n\n`));
          }
        }
        if (opts.onComplete) await opts.onComplete(full);
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
      } catch (err) {
        const message = opts.formatError
          ? opts.formatError(err)
          : err instanceof Error
            ? err.message
            : String(err);
        controller.enqueue(
          encoder.encode(`event: error\ndata: ${JSON.stringify({ message })}\n\n`),
        );
      } finally {
        controller.close();
      }
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
