import { describe, it, expect } from "vitest";
import { MODELS, listModels, getModel, DEFAULT_MODEL } from "~/lib/ai/models";
import { providerForModel } from "~/lib/ai/provider";

describe("model catalog", () => {
  it("has the default model", () => {
    expect(DEFAULT_MODEL in MODELS).toBe(true);
  });

  it("lists models with unique ids, including the local providers", () => {
    const ids = listModels().map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("ollama-llama3.1");
    expect(ids).toContain("lmstudio-local");
  });

  it("throws on an unknown model id", () => {
    expect(() => getModel("does-not-exist")).toThrow();
  });

  it("resolves a working provider implementation for every catalog model", () => {
    for (const { id } of listModels()) {
      const impl = providerForModel(id);
      expect(typeof impl.streamChat).toBe("function");
      expect(typeof impl.generate).toBe("function");
    }
  });
});
