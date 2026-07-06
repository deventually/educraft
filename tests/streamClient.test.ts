import { describe, it, expect, vi, afterEach } from "vitest";
import { streamPost, type StreamError } from "~/lib/streamClient";

/** Build a Response whose body streams the given SSE frames, then closes. */
function sseResponse(frames: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) controller.enqueue(enc.encode(f));
      controller.close();
    },
  });
  return new Response(body, { status });
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * streamPost must never invent human-readable copy (Phase 5.3). It surfaces the
 * server's already-localized `message` when the error frame carries one, and a
 * machine `code` otherwise — the caller (which holds `useT`) maps a code to
 * `m.error.unknown`.
 */
describe("streamClient — localization-neutral errors", () => {
  it("passes through the server's localized message on an error frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            `event: error\ndata: ${JSON.stringify({ message: "Ongeldig verzoek." })}\n\n`,
          ]),
        ),
    );
    let received: StreamError | undefined;
    await streamPost("/api/stream", {}, { onToken: () => {}, onError: (e) => (received = e) });
    expect(received).toEqual({ message: "Ongeldig verzoek." });
  });

  it("surfaces a parse code (never Dutch copy) when the error frame has no usable message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse(["event: error\ndata: not-json\n\n"])),
    );
    let received: StreamError | undefined;
    await streamPost("/api/stream", {}, { onToken: () => {}, onError: (e) => (received = e) });
    expect(received?.message).toBeUndefined();
    expect(received?.code).toBe("parse");
  });

  it("surfaces an http code (no invented string) for a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    let received: StreamError | undefined;
    await streamPost("/api/stream", {}, { onToken: () => {}, onError: (e) => (received = e) });
    expect(received?.code).toBe("http");
    expect(received?.status).toBe(500);
  });

  it("surfaces a network code when fetch itself rejects (non-abort)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    let received: StreamError | undefined;
    await streamPost("/api/stream", {}, { onToken: () => {}, onError: (e) => (received = e) });
    expect(received?.code).toBe("network");
  });

  it("still delivers token frames in order and completes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          sseResponse([
            `data: ${JSON.stringify({ t: "Hel" })}\n\n`,
            `data: ${JSON.stringify({ t: "lo" })}\n\n`,
            "event: done\ndata: {}\n\n",
          ]),
        ),
    );
    const tokens: string[] = [];
    let done = false;
    await streamPost(
      "/api/stream",
      {},
      { onToken: (t) => tokens.push(t), onDone: () => (done = true), onError: () => {} },
    );
    expect(tokens.join("")).toBe("Hello");
    expect(done).toBe(true);
  });
});
