import { afterEach, describe, expect, it, vi } from "vitest";

// Capture how the adapter builds each provider, without any network.
const { compatCalls } = vi.hoisted(() => ({
  compatCalls: [] as Array<{ name: string; baseURL: string; apiKey?: string }>,
}));
vi.mock("ai", () => ({
  generateText: vi.fn(async () => ({ text: "ok", usage: {} })),
  streamText: vi.fn(),
}));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: (cfg: { name: string; baseURL: string; apiKey?: string }) => {
    compatCalls.push(cfg);
    return { chatModel: (id: string) => ({ id }) };
  },
}));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => (id: string) => ({ id }) }));
vi.mock("~/server/env.server", () => ({
  env: { OPENAI_API_KEY: "sk-test", ANTHROPIC_API_KEY: "ak-test" },
  providerSetting: (name: string) =>
    process.env[name] ??
    (name === "OPENAI_API_KEY" ? "sk-test" : name === "ANTHROPIC_API_KEY" ? "ak-test" : undefined),
}));

import { aiSdkProvider } from "~/lib/ai/adapters/aisdk";
import { providerForModel } from "~/lib/ai/provider";
import { addModel, EMPTY_REGISTRY } from "~/lib/ai/modelRegistry";
import { installModelRegistry } from "~/lib/ai/models";

function install(provider: "openai" | "google", apiId: string): string {
  const res = addModel(EMPTY_REGISTRY, {
    provider,
    apiId,
    displayName: apiId,
    supportsImages: false,
    alwaysThinks: false,
    clientSelectable: true,
  });
  if (!res.ok) throw new Error(res.error);
  installModelRegistry(res.registry);
  return res.id;
}

const call = (model: string) =>
  aiSdkProvider.generate({ model, system: "s", messages: [{ role: "user", content: "hi" }] });

afterEach(() => installModelRegistry(EMPTY_REGISTRY));

describe("AI SDK adapter — models added for any provider", () => {
  it("serves an added OpenAI model at OpenAI's address with the server's key", async () => {
    const id = install("openai", "gpt-test");
    expect(providerForModel(id)).toBe(aiSdkProvider);
    await call(id);
    expect(compatCalls.at(-1)).toMatchObject({
      name: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-test",
    });
  });

  it("explains which server setting is missing when a provider has no key", async () => {
    const id = install("google", "gemini-test");
    await expect(call(id)).rejects.toThrow(/GOOGLE_GENERATIVE_AI_API_KEY/);
  });
});

describe("AI SDK adapter — providers and settings from config/models.json", () => {
  it("serves OpenRouter at its address with its key from the server", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "or-test");
    try {
      await call("openrouter-auto");
      expect(compatCalls.at(-1)).toMatchObject({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "or-test",
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("sends a model's effort, and no temperature when the config says null", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { generateText } = await import("ai");
    await call("gpt-6.1-sol");
    const opts = vi.mocked(generateText).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(opts.temperature).toBeUndefined();
    expect(opts.providerOptions).toEqual({ openai: { reasoningEffort: "medium" } });
    vi.unstubAllEnvs();
  });

  it("sends Claude's effort the Anthropic way", async () => {
    const { generateText } = await import("ai");
    await call("claude-sonnet-5-5");
    const opts = vi.mocked(generateText).mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(opts.providerOptions).toEqual({ anthropic: { effort: "medium" } });
    expect(opts.temperature).toBe(0.4);
  });
});

describe("AI SDK adapter — a provider the admin added", () => {
  it("serves its model at its own address, on the intranet without a key", async () => {
    const { addProvider } = await import("~/lib/ai/modelRegistry");
    const p = addProvider(EMPTY_REGISTRY, {
      name: "Eigen server",
      api: "openai-compatible",
      baseURL: "http://10.0.0.5:8000/v1",
      noKey: true,
    });
    if (!p.ok) throw new Error(p.error);
    const m = addModel(p.registry, {
      provider: "eigen-server",
      apiId: "qwen3-32b",
      displayName: "Qwen 3 (intranet)",
      supportsImages: false,
      alwaysThinks: false,
      clientSelectable: true,
    });
    if (!m.ok) throw new Error(m.error);
    installModelRegistry(m.registry);
    expect(providerForModel(m.id)).toBe(aiSdkProvider);
    await call(m.id);
    expect(compatCalls.at(-1)).toMatchObject({
      name: "eigen-server",
      baseURL: "http://10.0.0.5:8000/v1",
    });
    expect(compatCalls.at(-1)?.apiKey).toBeUndefined();
  });
});

describe("AI SDK adapter — prompt caching, as the provider wants it", () => {
  const turns = [
    { role: "user" as const, content: "eerste" },
    { role: "assistant" as const, content: "antwoord" },
    { role: "user" as const, content: "laatste" },
  ];
  const chat = (model: string, cacheKey?: string) =>
    aiSdkProvider.generate({ model, system: "systeem", messages: turns, cacheKey });
  interface Sent {
    system: unknown;
    messages: Array<{ content: unknown; providerOptions?: unknown }>;
    providerOptions?: Record<string, Record<string, string>>;
  }
  const lastCall = async () => {
    const { generateText } = await import("ai");
    return vi.mocked(generateText).mock.calls.at(-1)?.[0] as unknown as Sent;
  };
  const EPHEMERAL = { anthropic: { cacheControl: { type: "ephemeral" } } };

  it("marks Claude's system prompt and the turn before the last, never the changing last turn", async () => {
    await chat("claude-sonnet-5-5", "user-1:socratic-partner");
    const opts = await lastCall();
    expect(opts.system).toEqual({ role: "system", content: "systeem", providerOptions: EPHEMERAL });
    expect(opts.messages[1]).toMatchObject({ content: "antwoord", providerOptions: EPHEMERAL });
    expect(opts.messages[0]?.providerOptions).toBeUndefined();
    expect(opts.messages[2]?.providerOptions).toBeUndefined();
    expect(opts.providerOptions).toEqual({ anthropic: { effort: "medium" } });
  });

  it("caches nothing when the call asks for no caching (a one-off generation)", async () => {
    await chat("claude-sonnet-5-5");
    const opts = await lastCall();
    expect(opts.system).toBe("systeem");
    expect(opts.messages.some((m) => m.providerOptions)).toBe(false);
  });

  it("sends a key provider an opaque key next to its effort, never the raw user id", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    await chat("gpt-6.1-sol", "user-1:socratic-partner");
    const opts = await lastCall();
    const sent = opts.providerOptions?.openai;
    expect(sent?.reasoningEffort).toBe("medium");
    expect(sent?.prompt_cache_key).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(opts)).not.toContain("user-1");
    await chat("gpt-6.1-sol", "user-1:socratic-partner");
    expect((await lastCall()).providerOptions?.openai?.prompt_cache_key).toBe(
      sent?.prompt_cache_key,
    );
    vi.unstubAllEnvs();
  });

  it("sends a provider that caches by itself nothing extra", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "g-test");
    await chat("gemini-4-argon", "user-1:socratic-partner");
    const opts = await lastCall();
    expect(opts.system).toBe("systeem");
    expect(opts.providerOptions).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
