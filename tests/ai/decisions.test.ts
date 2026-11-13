import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { postDecisions } from "~/lib/ai/decisions";
import { DECISIONS, MODELS, parseModelsConfig } from "~/lib/ai/models";
import { JEV_KEY_ENV, JEV_MODEL } from "../../scripts/eval-evidence-jev-helpers";

const raw = JSON.parse(readFileSync(resolve(__dirname, "../../config/models.json"), "utf8"));

describe("config/models.json — Jev is its own entry, next to the models, not one of them", () => {
  it("names OpenRouter's Decisions API, the pinned Jev the evals measured, and a key of its own", () => {
    expect(DECISIONS).toMatchObject({
      provider: "openrouter",
      url: "https://openrouter.ai/api/alpha/decisions",
      model: JEV_MODEL,
    });
    // Bastiaan, 2026-11-13: "Jev moet een eigen API key hebben" (own spending limit, own bill).
    expect(DECISIONS?.keyEnv).toBe("JEV_API_KEY");
    expect(JEV_KEY_ENV).toBe(DECISIONS?.keyEnv);
  });

  it("is no chat model: it can never be picked as the LLM, and OpenRouter's models stay", () => {
    for (const [id, m] of Object.entries(MODELS)) expect(m.apiId, id).not.toBe(JEV_MODEL);
    expect(Object.values(MODELS).some((m) => m.provider === "openrouter")).toBe(true);
  });

  it("may be left out, and refuses an unknown provider, a non-https address, a key value or no own key", () => {
    const { decisions, ...rest } = raw;
    expect(parseModelsConfig(rest).decisions).toBeUndefined();
    expect(() =>
      parseModelsConfig({ ...rest, decisions: { ...decisions, provider: "acme" } }),
    ).toThrow(/decisions/);
    expect(() =>
      parseModelsConfig({ ...rest, decisions: { ...decisions, provider: "claude-code" } }),
    ).toThrow(/decisions/);
    expect(() =>
      parseModelsConfig({ ...rest, decisions: { ...decisions, url: "http://example.com/d" } }),
    ).toThrow(/decisions/);
    expect(() =>
      parseModelsConfig({ ...rest, decisions: { ...decisions, keyEnv: "sk-or-v1-abc" } }),
    ).toThrow(/decisions/);
    const { keyEnv: _key, ...keyless } = decisions;
    expect(() => parseModelsConfig({ ...rest, decisions: keyless })).toThrow(/decisions/);
    expect(() =>
      parseModelsConfig({ ...rest, decisions: { ...decisions, keyEnv: "OPENROUTER_API_KEY" } }),
    ).toThrow(/own key/);
  });
});

describe("postDecisions — one POST to the Decisions API", () => {
  const payload = { model: "jev-x", state: { outcome: "x" }, questions: {} };

  it("sends the payload with the key and returns the answer", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ answers: {} }), { status: 200 });
    }) as typeof fetch;
    const body = await postDecisions("https://d.example/decisions", payload, {
      apiKey: "k",
      fetch: fetchFn,
    });
    expect(calls[0]?.url).toBe("https://d.example/decisions");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer k");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(payload);
    expect(body).toEqual({ answers: {} });
  });

  it("throws with the status on an error", async () => {
    const fetchFn = (async () => new Response("no", { status: 402 })) as unknown as typeof fetch;
    await expect(
      postDecisions("https://d.example/decisions", payload, { apiKey: "k", fetch: fetchFn }),
    ).rejects.toThrow(/402/);
  });
});
