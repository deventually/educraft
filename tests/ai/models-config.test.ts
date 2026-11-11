import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, getProvider, MODELS, parseModelsConfig } from "~/lib/ai/models";

const file = resolve(__dirname, "../../config/models.json");
const raw = JSON.parse(readFileSync(file, "utf8"));

describe("config/models.json — the built-in model list lives in a config file", () => {
  it("is the source of the catalog and the default model", () => {
    const parsed = parseModelsConfig(raw);
    expect(Object.keys(MODELS)).toEqual(parsed.models.map((m) => m.id));
    expect(DEFAULT_MODEL).toBe(raw.default);
  });

  it("keeps today's models", () => {
    expect(Object.keys(MODELS)).toEqual(
      expect.arrayContaining(["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5"]),
    );
  });

  it("refuses a broken file with a message that names the problem", () => {
    const { providers } = raw;
    expect(() => parseModelsConfig({ default: "x", providers, models: [] })).toThrow(
      /models\.json/,
    );
    const one = raw.models[0];
    expect(() => parseModelsConfig({ default: one.id, providers, models: [one, one] })).toThrow(
      /twice/,
    );
    expect(() => parseModelsConfig({ default: "nope", providers, models: [one] })).toThrow(
      /default/,
    );
  });

  it("refuses a model with an unknown provider or bad settings", () => {
    const one = raw.models[0];
    const base = { ...raw, default: one.id };
    expect(() => parseModelsConfig({ ...base, models: [{ ...one, provider: "acme" }] })).toThrow(
      /provider/,
    );
    expect(() =>
      parseModelsConfig({ ...base, models: [{ ...one, settings: { effort: "huge" } }] }),
    ).toThrow(/effort/);
    expect(() =>
      parseModelsConfig({ ...base, models: [{ ...one, settings: { temperature: 7 } }] }),
    ).toThrow(/temperature/);
  });
});

describe("config/models.json — what Bastiaan asked for (2026-11-06)", () => {
  it("has the newest Opus, Sonnet and Haiku", () => {
    for (const id of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]) {
      expect(MODELS[id]?.provider, id).toBe("anthropic");
    }
  });

  it("has a model for ChatGPT, Gemini, Zen, OpenRouter, Mistral, MiniMax, GLM, Grok, Qwen and Meta", () => {
    const providers = new Set(Object.values(MODELS).map((m) => m.provider));
    const wanted = ["openai", "google", "opencode-zen", "openrouter", "mistral", "minimax"];
    for (const p of [...wanted, "zai", "xai", "qwen", "together"]) {
      expect(providers.has(p), p).toBe(true);
      expect(getProvider(p)?.keyEnv, p).toMatch(/_API_KEY$/);
    }
  });

  it("keeps the CLI agents (Codex, opencode, Claude Code)", () => {
    for (const id of ["codex", "opencode", "claude-code"]) {
      expect(MODELS[id]?.local, id).toBe(true);
    }
  });

  it("gives every model its settings (effort, temperature) where set", () => {
    expect(MODELS["claude-sonnet-5-5"]!.settings).toMatchObject({ effort: "medium" });
    // A reasoning model that refuses a temperature: null = never send one.
    expect(MODELS["gpt-6.1-sol"]!.settings?.temperature).toBeNull();
  });
});
