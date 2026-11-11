import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Isolated in-memory DB + a small daily token brake, set before any server module loads.
process.env.DATABASE_URL = "file::memory:";
process.env.DAILY_OUTPUT_TOKEN_LIMIT = "100";
process.env.RATE_LIMIT_PER_MINUTE = "1000";

// Replace the real provider so no model call happens; the spy also lets us assert
// that an over-quota request never reaches the provider.
const { streamChatSpy } = vi.hoisted(() => ({ streamChatSpy: vi.fn() }));
vi.mock("~/lib/ai/provider", () => ({
  providerForModel: vi.fn(() => ({ id: "mock", generate: vi.fn(), streamChat: streamChatSpy })),
}));

// Stub auth: id from `x-test-user`, role from `x-test-role` (default teacher).
const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));
vi.mock("~/server/auth.server", () => ({ getUser: getUserMock }));

type ActionMod = typeof import("~/routes/api.stream");
let action: ActionMod["action"];
let quotaExceededMsg: string;

beforeAll(async () => {
  ({ action } = await import("~/routes/api.stream"));
  const { getMessages } = await import("~/lib/i18n");
  quotaExceededMsg = getMessages("nl").error.quotaExceeded;
});

beforeEach(() => {
  streamChatSpy.mockReset();
  streamChatSpy.mockImplementation(async function* () {
    yield "ok";
  });
  getUserMock.mockReset();
  getUserMock.mockImplementation(async (request: Request) => ({
    id: request.headers.get("x-test-user") ?? "anon",
    name: "Test User",
    email: null,
    role: (request.headers.get("x-test-role") ?? "teacher") as "teacher" | "admin",
    createdAt: new Date(0),
  }));
});

function sseErrorMessage(sseText: string): string | null {
  const match = /event: error\ndata: (.*)/.exec(sseText);
  if (!match) return null;
  try {
    return JSON.parse(match[1]!).message as string;
  } catch {
    return null;
  }
}

/** A valid one-shot socratic-partner body (no sessionId → one-shot save path). */
function body() {
  return { slug: "socratic-partner", values: { chapter: "Photosynthesis" }, messages: [] };
}

async function generate(userId: string, role = "teacher"): Promise<Response> {
  const request = new Request("http://localhost/api/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-test-user": userId,
      "x-test-role": role,
    },
    body: JSON.stringify(body()),
  });
  return action({ request } as Parameters<typeof action>[0]);
}

describe("api.stream — daily quota", () => {
  it("lets a teacher make many calls in a day: no limit on the number", async () => {
    const user = "quota-many";
    for (let i = 0; i < 60; i++) {
      const res = await generate(user);
      expect(sseErrorMessage(await res.text())).toBeNull();
    }
    expect(streamChatSpy).toHaveBeenCalledTimes(60);
  });

  it("refuses generation past the day's output tokens with a localized error", async () => {
    const user = "quota-teacher";
    const { recordUsage } = await import("~/server/repositories/usage.server");
    await recordUsage(user, { chars: 1, tokens: 100 });

    // Refused before the provider is touched.
    const res = await generate(user);
    const text = await res.text();
    expect(sseErrorMessage(text)).toBe(quotaExceededMsg);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("exempts admins from the quota", async () => {
    const admin = "quota-admin";
    const { recordUsage } = await import("~/server/repositories/usage.server");
    await recordUsage(admin, { chars: 1, tokens: 1_000 });
    for (let i = 0; i < 4; i++) {
      const res = await generate(admin, "admin");
      const text = await res.text();
      expect(sseErrorMessage(text)).toBeNull();
    }
    expect(streamChatSpy).toHaveBeenCalledTimes(4);
  });
});

describe("api.stream — monthly limit in euros (PR D)", () => {
  it("refuses a teacher whose month is spent, before the provider, with its own message", async () => {
    const { setAiLimit } = await import("~/server/repositories/aiLimits.server");
    const { recordAiUsage } = await import("~/server/repositories/aiUsage.server");
    const { getMessages } = await import("~/lib/i18n");
    await setAiLimit({ kind: "user", id: "limit-teacher" }, 1);
    await recordAiUsage("limit-teacher", { source: "x", model: "m", costMicros: 1_000_000 });

    const res = await generate("limit-teacher");
    expect(sseErrorMessage(await res.text())).toBe(getMessages("nl").error.limitReached);
    expect(streamChatSpy).not.toHaveBeenCalled();
  });

  it("never limits an admin", async () => {
    const { setAiLimit } = await import("~/server/repositories/aiLimits.server");
    await setAiLimit({ kind: "budget" }, 0.01);
    const { recordAiUsage } = await import("~/server/repositories/aiUsage.server");
    await recordAiUsage("limit-admin", { source: "x", model: "m", costMicros: 5_000_000 });
    const res = await generate("limit-admin", "admin");
    expect(sseErrorMessage(await res.text())).toBeNull();
    expect(streamChatSpy).toHaveBeenCalledTimes(1);
    await setAiLimit({ kind: "budget" }, null);
  });
});
