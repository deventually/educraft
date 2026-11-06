import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_MODEL, MODELS, parseModelsConfig } from "~/lib/ai/models";

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
    expect(() => parseModelsConfig({ default: "x", models: [] })).toThrow(/config\/models\.json/);
    const one = raw.models[0];
    expect(() => parseModelsConfig({ default: one.id, models: [one, one] })).toThrow(/twice/);
    expect(() => parseModelsConfig({ default: "nope", models: [one] })).toThrow(/default/);
    expect(() =>
      parseModelsConfig({ default: one.id, models: [{ ...one, provider: "acme" }] }),
    ).toThrow(/provider/);
  });
});
