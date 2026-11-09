import { describe, it, expect, vi, afterEach } from "vitest";
import { sseStream, SSE_HEARTBEAT_MS } from "~/lib/ai/sse";

/**
 * Long answers must survive a proxy (Cloudflare drops a connection after 100 s without
 * data) and stop costing tokens once the teacher closes the tab.
 */

/** A source that yields nothing until `release()` is called, then one chunk. */
function slowSource() {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  async function* gen() {
    await gate;
    yield "answer";
  }
  return { source: gen(), release };
}

async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return out;
    out += dec.decode(value);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("sseStream — heartbeat", () => {
  it("beats about every 15 seconds, well under a proxy's 100 s idle limit", () => {
    expect(SSE_HEARTBEAT_MS).toBeGreaterThanOrEqual(10_000);
    expect(SSE_HEARTBEAT_MS).toBeLessThanOrEqual(30_000);
  });

  it("sends an SSE comment while the model is still silent, then the answer", async () => {
    vi.useFakeTimers();
    const { source, release } = slowSource();
    const reader = sseStream(source, { heartbeatMs: 1000 }).getReader();
    const reading = readAll(reader);
    await vi.advanceTimersByTimeAsync(2500);
    release();
    const text = await reading;
    expect(text.match(/^: keep-alive\n\n/gm)).toHaveLength(2);
    expect(text).toContain(`data: {"t":"answer"}`);
    expect(text).toContain("event: done");
  });

  it("stops beating once the stream has ended", async () => {
    vi.useFakeTimers();
    const { source, release } = slowSource();
    const reading = readAll(sseStream(source, { heartbeatMs: 1000 }).getReader());
    release();
    await reading;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("sseStream — the reader goes away", () => {
  it("calls onCancel and onFinally once, stops the heartbeat, and never throws", async () => {
    vi.useFakeTimers();
    const onCancel = vi.fn();
    const onFinally = vi.fn();
    const onComplete = vi.fn();
    const formatError = vi.fn(() => "x");
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    // Like a provider whose request was aborted: it throws once cancelled.
    async function* source() {
      yield "partial";
      await gate;
      throw new DOMException("aborted", "AbortError");
    }
    const reader = sseStream(source(), {
      heartbeatMs: 1000,
      onCancel: () => {
        onCancel();
        release();
      },
      onFinally,
      onComplete,
      formatError,
    }).getReader();
    await reader.read(); // the "partial" token
    await reader.cancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onFinally).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(formatError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
