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
  env: { OPENAI_API_KEY: "sk-test", GOOGLE_GENERATIVE_AI_API_KEY: undefined },
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
