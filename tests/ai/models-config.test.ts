import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MODEL,
  effectivePrice,
  getProvider,
  MODELS,
  parseModelsConfig,
} from "~/lib/ai/models";

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
    const { providers, exchangeRate } = raw;
    expect(() => parseModelsConfig({ default: "x", providers, models: [] })).toThrow(
      /models\.json/,
    );
    const one = raw.models[0];
    expect(() =>
      parseModelsConfig({ default: one.id, providers, exchangeRate, models: [one, one] }),
    ).toThrow(/twice/);
    expect(() =>
      parseModelsConfig({ default: "nope", providers, exchangeRate, models: [one] }),
    ).toThrow(/default/);
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

describe("config/models.json — a model's list price (usage dashboard)", () => {
  const one = raw.models.find((m: { provider: string }) => m.provider === "anthropic");
  const priced = {
    ...one,
    price: {
      currency: "USD",
      input: 3,
      output: 15,
      cacheRead: 0.3,
      checked: "2026-11-11",
      source: "https://example.com/pricing",
    },
  };
  const rate = { usdToEur: 0.9, checked: "2026-11-11", source: "https://example.com/rate" };

  it("accepts a dated, sourced price with an exchange rate for dollars", () => {
    const parsed = parseModelsConfig({
      ...raw,
      default: one.id,
      models: [priced],
      exchangeRate: rate,
    });
    expect(parsed.models[0]?.price?.input).toBe(3);
  });

  it("refuses a dollar price without an exchange rate, or without a source", () => {
    const { exchangeRate: _rate, ...withoutRate } = raw;
    expect(() => parseModelsConfig({ ...withoutRate, default: one.id, models: [priced] })).toThrow(
      /exchangeRate/,
    );
    const { source: _, ...unsourced } = priced.price;
    expect(() =>
      parseModelsConfig({
        ...raw,
        default: one.id,
        models: [{ ...one, price: unsourced }],
        exchangeRate: rate,
      }),
    ).toThrow(/models\.json/);
  });
});

describe("effectivePrice — the price a call is counted at", () => {
  it("is the catalog's list price in euros, dated, when the admin set none", () => {
    const p = effectivePrice("claude-sonnet-5-5", {});
    expect(p).toMatchObject({
      from: "catalog",
      checked: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(p?.price.input).toBeGreaterThan(0);
  });

  it("is the admin's own price when there is one", () => {
    const own = { input: 1, output: 2 };
    expect(effectivePrice("claude-sonnet-5-5", { "claude-sonnet-5-5": own })).toEqual({
      price: own,
      from: "admin",
    });
  });

  it("is null for a model without any price", () => {
    expect(effectivePrice("openrouter-auto", {})).toBeNull();
  });

  it("every API model in the catalog has a price, except the router without a fixed one", () => {
    const unpriced = raw.models
      .filter((m: { local?: boolean; price?: unknown }) => !m.local && !m.price)
      .map((m: { id: string }) => m.id);
    expect(unpriced).toEqual(["openrouter-auto"]);
  });
});
