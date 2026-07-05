import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory SQLite before any server module loads.
process.env.DATABASE_URL = "file::memory:";

// Replace the real provider so no model call happens; the spy captures the model
// the route resolves.
const { streamChatSpy } = vi.hoisted(() => ({ streamChatSpy: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({
  providerForModel: vi.fn(() => ({ id: "mock", generate: vi.fn(), streamChat: streamChatSpy })),
}));

// Stub auth: a teacher whose id follows the session id (rate limiter is per-user).
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ getUser: getUserMock }));

type ActionMod = typeof import("~/routes/api.stream");
type Settings = typeof import("~/server/repositories/settings.server");
let action: ActionMod["action"];
let settings: Settings;
let notAllowedMsg: string;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.stream"));
  settings = await import("~/server/repositories/settings.server");
  const { getMessages } = await import("~/lib/i18n");
  notAllowedMsg = getMessages("nl").error.notAllowed;
});

beforeEach(() => {
  streamChatSpy.mockReset();
  streamChatSpy.mockImplementation(async function* () {
    yield "ok";
  });
  getUserMock.mockReset();
  getUserMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "anon",
    name: "Test Teacher",
    email: null,
    role: "teacher" as const,
    createdAt: new Date(0),
  }));
});

function invoke(body: Record<string, unknown>): Promise<Response> {
  const sessionId = String(body.sessionId ?? "");
  const request = new Request("http://localhost/api/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionId ? { "x-test-user": sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  return action({ request } as Parameters<typeof action>[0]);
}

function sseErrorMessage(sseText: string): string | null {
  const match = /event: error\ndata: (.*)/.exec(sseText);
  if (!match) return null;
  try {
    return JSON.parse(match[1]).message as string;
  } catch {
    return null;
  }
}

const base = (overrides: Record<string, unknown> = {}) => ({
  slug: "socratic-partner",
  values: { chapter: "Evolution" },
  messages: [{ role: "user", content: "Hi" }],
  ...overrides,
});

describe("api.stream — instance availability (Phase 4)", () => {
  it("falls back to the tool default when the requested model is not admin-enabled", async () => {
    // Enable only Sonnet → a request for Haiku (client-selectable, but disabled by
    // the admin) is ignored and the tool default (Sonnet) is used instead.
    await settings.setEnabledModels(["claude-sonnet-4-6"]);
    await invoke(base({ model: "claude-haiku-4-5", sessionId: "avail-model-1" }));
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    expect(streamChatSpy.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
    await settings.setEnabledModels(null); // reset
  });

  it("refuses generation for an instance-disabled tool with a localized SSE error", async () => {
    await settings.setToolSetting("socratic-partner", { enabled: false });
    const res = await invoke(base({ sessionId: "avail-disabled-1" }));
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(notAllowedMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
    await settings.setToolSetting("socratic-partner", { enabled: true }); // reset
  });
});
