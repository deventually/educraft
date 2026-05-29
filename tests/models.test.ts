import { describe, it, expect } from "vitest";
import {
  MODELS,
  listModels,
  getModel,
  DEFAULT_MODEL,
  dynamicModelId,
  resolveModelInfo,
  isResolvableModel,
} from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";

describe("model catalog", () => {
  it("has the default model", () => {
    expect(DEFAULT_MODEL in MODELS).toBe(true);
  });

  it("lists static models with unique ids, including the CLI agents", () => {
    const ids = listModels().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("claude-code");
    expect(ids).toContain("gemini-cli");
  });

  it("does not statically list discovered local models", () => {
    const ids = listModels().map((m) => m.id);
    expect(ids.some((id) => id.startsWith("ollama"))).toBe(false);
    expect(ids.some((id) => id.startsWith("lmstudio"))).toBe(false);
  });

  it("throws on an unknown model id", () => {
    expect(() => getModel("does-not-exist")).toThrow();
    expect(() => resolveModelInfo("does-not-exist")).toThrow();
  });

  it("resolves a working provider implementation for every static model", () => {
    for (const { id } of listModels()) {
      const impl = providerForModel(id);
      expect(typeof impl.streamChat).toBe("function");
      expect(typeof impl.generate).toBe("function");
    }
  });
});

describe("dynamic local model resolution", () => {
  it("builds a runtime id from provider + apiId", () => {
    expect(dynamicModelId("ollama", "gemma4:31b")).toBe("ollama::gemma4:31b");
  });

  it("resolves a discovered id to a local ModelInfo (preserving colons in apiId)", () => {
    const info = resolveModelInfo("ollama::gemma4:31b");
    expect(info.provider).toBe("ollama");
    expect(info.apiId).toBe("gemma4:31b");
    expect(info.local).toBe(true);
  });

  it("treats dynamic ids as resolvable and routes them to a provider", () => {
    expect(isResolvableModel("lmstudio::some-model")).toBe(true);
    expect(isResolvableModel("ollama::x")).toBe(true);
    expect(isResolvableModel("nope")).toBe(false);
    expect(typeof providerForModel("ollama::gemma4:31b").streamChat).toBe("function");
  });
});
