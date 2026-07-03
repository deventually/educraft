import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Point the DB at an isolated in-memory SQLite before any server module loads,
// so consuming a stream (which saves a generation on completion) never touches
// the on-disk dev database.
process.env.DATABASE_URL = "file::memory:";

// Replace the real provider so no network/model call happens; the spy captures
// the options the route hands to streamChat (model, maxTokens, …).
const { streamChatSpy } = vi.hoisted(() => ({ streamChatSpy: vi.fn() }));

vi.mock("~/lib/ai/provider", () => ({
  providerForModel: vi.fn(() => ({
    id: "mock",
    generate: vi.fn(),
    streamChat: streamChatSpy,
  })),
}));

type ActionMod = typeof import("~/routes/api.stream");
let action: ActionMod["action"];
let invalidRequestMsg: string;
let rateLimitedMsg: string;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.stream"));
  const { getMessages } = await import("~/lib/i18n");
  invalidRequestMsg = getMessages("nl").error.invalidRequest;
  rateLimitedMsg = getMessages("nl").error.rateLimited;
});

beforeEach(() => {
  streamChatSpy.mockReset();
  streamChatSpy.mockImplementation(async function* () {
    yield "ok";
  });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function invoke(body: unknown, headers?: Record<string, string>): Promise<Response> {
  const request = makeRequest(body, headers);
  return action({ request } as Parameters<typeof action>[0]);
}

/** Extract the message from an `event: error` SSE frame, or null if none. */
function sseErrorMessage(sseText: string): string | null {
  const match = /event: error\ndata: (.*)/.exec(sseText);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).message as string;
  } catch {
    return null;
  }
}

/** A valid socratic-partner (chat, no context profile, single {{chapter}}) body. */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    slug: "socratic-partner",
    values: { chapter: "Evolution by natural selection" },
    messages: [{ role: "user", content: "Hi" }],
    ...overrides,
  };
}

describe("api.stream — request validation", () => {
  it("rejects a body that is not JSON with a localized error and no provider call", async () => {
    const res = await invoke("this is not json{");
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(invalidRequestMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("rejects a body missing `slug`", async () => {
    const res = await invoke({ values: {} });
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(invalidRequestMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("rejects a form value that exceeds the per-field character cap", async () => {
    const res = await invoke(validBody({ values: { chapter: "x".repeat(30_000) } }));
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(invalidRequestMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("rejects a messages array beyond the maximum length", async () => {
    const messages = Array.from({ length: 101 }, () => ({ role: "user", content: "hi" }));
    const res = await invoke(validBody({ messages }));
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(invalidRequestMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("rejects an oversized raw body via the content-length guard", async () => {
    const res = await invoke(validBody({ sessionId: "cl-guard-session" }), {
      "content-length": String(26 * 1024 * 1024),
    });
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(invalidRequestMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });
});

describe("api.stream — model allow-list", () => {
  it("ignores a non-client-selectable model (Opus) and uses the tool default", async () => {
    await invoke(validBody({ model: "claude-opus-4-8", sessionId: "allowlist-opus-1" }));
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("honors a client-selectable model (Haiku)", async () => {
    await invoke(validBody({ model: "claude-haiku-4-5", sessionId: "allowlist-haiku-1" }));
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-haiku-4-5");
  });

  it("streams with the tool's configured maxTokens budget", async () => {
    await invoke(validBody({ sessionId: "maxtokens-check-1" }));
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    // socratic-partner is a chat tool → 2048.
    expect(streamChatSpy.mock.calls[0][0].maxTokens).toBe(2048);
  });
});

describe("api.stream — rate limiting", () => {
  it("refuses the request past the per-minute budget with a localized error", async () => {
    const sessionId = "rate-limit-session-xyz";
    // Default budget is 10 requests/minute. Drain it, releasing each stream so the
    // concurrency cap is never the limiting factor.
    for (let i = 0; i < 10; i++) {
      const res = await invoke(validBody({ sessionId }));
      await res.text(); // consume → completes → releases the concurrency slot
    }
    expect(streamChatSpy).toHaveBeenCalledTimes(10);

    const res = await invoke(validBody({ sessionId }));
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(rateLimitedMsg);
    // The 11th call never reached the provider.
    expect(streamChatSpy).toHaveBeenCalledTimes(10);
  });
});
