import { describe, it, expect } from "vitest";
import {
  MODELS,
  listModels,
  getModel,
  DEFAULT_MODEL,
  dynamicModelId,
  resolveModelInfo,
  isResolvableModel,
  isClientSelectable,
  pickableModels,
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

describe("pickableModels (the picker list shared by every screen)", () => {
  const local = [
    { id: "ollama::gemma4:31b", displayName: "Ollama · gemma4:31b", supportsImages: false },
    { id: "lmstudio::qwen3", displayName: "LM Studio · qwen3", supportsImages: false },
  ];

  it("includes the API-key catalog AND the CLI agents", () => {
    const ids = pickableModels().map((m) => m.id);
    expect(ids).toContain("claude-sonnet-4-6");
    expect(ids).toContain("claude-code");
    expect(ids).toContain("gemini-cli");
  });

  it("appends discovered local models (Ollama / LM Studio)", () => {
    const ids = pickableModels(local).map((m) => m.id);
    expect(ids).toContain("ollama::gemma4:31b");
    expect(ids).toContain("lmstudio::qwen3");
  });

  it("offers only catalog ids that actually resolve (no stale ids)", () => {
    for (const m of pickableModels(local)) {
      expect(isResolvableModel(m.id)).toBe(true);
    }
    // The stale chat-only Opus id must never appear.
    expect(pickableModels().map((m) => m.id)).not.toContain("claude-opus-4-7");
  });

  it("filters to vision-capable models when requiresImages is set", () => {
    const ids = pickableModels(local, true).map((m) => m.id);
    expect(ids).not.toContain("ollama::gemma4:31b");
    expect(ids).toContain("claude-sonnet-4-6");
  });

  it("excludes local models with UNKNOWN image support from a vision picker", () => {
    // discover.server may omit the flag → undefined; it must NOT pass the vision filter.
    const unknown = [{ id: "ollama::mystery", displayName: "Ollama · mystery" }];
    const ids = pickableModels(unknown, true).map((m) => m.id);
    expect(ids).not.toContain("ollama::mystery");
  });

  it("keeps vision-capable local models in a vision picker", () => {
    const visionLocal = [
      { id: "ollama::llava", displayName: "Ollama · llava", supportsImages: true },
    ];
    const ids = pickableModels(visionLocal, true).map((m) => m.id);
    expect(ids).toContain("ollama::llava");
  });
});

describe("client-selectable model allow-list", () => {
  it("marks Haiku and Sonnet as client-selectable but never Opus", () => {
    expect(isClientSelectable("claude-haiku-4-5")).toBe(true);
    expect(isClientSelectable("claude-sonnet-4-6")).toBe(true);
    // Opus is reachable only as a tool/stage default, never forced by a caller.
    expect(isClientSelectable("claude-opus-4-8")).toBe(false);
  });

  it("keeps the local CLI agents client-selectable (they cost the owner nothing)", () => {
    expect(isClientSelectable("claude-code")).toBe(true);
    expect(isClientSelectable("opencode")).toBe(true);
    expect(isClientSelectable("codex")).toBe(true);
    expect(isClientSelectable("gemini-cli")).toBe(true);
  });

  it("treats discovered local models (Ollama / LM Studio) as selectable free inference", () => {
    expect(isClientSelectable("ollama::gemma4:31b")).toBe(true);
    expect(isClientSelectable("lmstudio::qwen3")).toBe(true);
  });

  it("returns false for unknown ids", () => {
    expect(isClientSelectable("does-not-exist")).toBe(false);
  });

  it("sets clientSelectable on every static catalog entry", () => {
    for (const m of listModels()) {
      expect(typeof m.clientSelectable, `${m.id} needs a clientSelectable flag`).toBe("boolean");
    }
  });

  it("never offers Opus in the picker (the server would swap it anyway)", () => {
    expect(pickableModels().map((m) => m.id)).not.toContain("claude-opus-4-8");
    // Selectable models still appear.
    expect(pickableModels().map((m) => m.id)).toContain("claude-sonnet-4-6");
    expect(pickableModels().map((m) => m.id)).toContain("claude-haiku-4-5");
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
