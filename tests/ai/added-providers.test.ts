import { afterEach, describe, expect, it } from "vitest";
import {
  addModel,
  addProvider,
  EMPTY_REGISTRY,
  parseModelRegistry,
  removeProvider,
  type ModelRegistry,
} from "~/lib/ai/modelRegistry";
import { getProvider, installModelRegistry, listProviders } from "~/lib/ai/models";
import { credentialKeyFor } from "~/lib/ai/credentials";

const deepseek = {
  name: "DeepSeek",
  api: "openai-compatible" as const,
  baseURL: "https://api.deepseek.com/v1",
  modelsUrl: "https://api-docs.deepseek.com/quick_start/pricing",
};

function withDeepseek(): ModelRegistry {
  const res = addProvider(EMPTY_REGISTRY, deepseek);
  if (!res.ok) throw new Error(res.error);
  return res.registry;
}

afterEach(() => installModelRegistry(EMPTY_REGISTRY));

describe("added providers — an admin adds a provider from the screen", () => {
  it("derives the id and a fresh key setting from the name", () => {
    const res = addProvider(EMPTY_REGISTRY, deepseek);
    expect(res).toMatchObject({ ok: true, id: "deepseek", keyEnv: "DEEPSEEK_API_KEY" });
    const two = addProvider(EMPTY_REGISTRY, { ...deepseek, name: "Groq Cloud EU" });
    expect(two).toMatchObject({ ok: true, id: "groq-cloud-eu", keyEnv: "GROQ_CLOUD_EU_API_KEY" });
  });

  it("refuses a name that is empty or has no letters to make an id from", () => {
    expect(addProvider(EMPTY_REGISTRY, { ...deepseek, name: "  " })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(addProvider(EMPTY_REGISTRY, { ...deepseek, name: "123" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("only talks to an https address", () => {
    expect(
      addProvider(EMPTY_REGISTRY, { ...deepseek, baseURL: "http://api.deepseek.com" }),
    ).toEqual({ ok: false, error: "insecure" });
    expect(addProvider(EMPTY_REGISTRY, { ...deepseek, baseURL: "not a url" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("an own server on the intranet may use plain http, and may need no key", () => {
    for (const baseURL of [
      "http://10.0.0.5:8000/v1",
      "http://192.168.1.20:11434/v1",
      "http://172.20.0.3/v1",
      "http://gpu-server:8000/v1",
      "http://llm.school.local/v1",
      "http://llm.intern.internal/v1",
    ]) {
      const res = addProvider(EMPTY_REGISTRY, { ...deepseek, name: "Eigen server", baseURL });
      expect(res.ok, baseURL).toBe(true);
    }
    for (const baseURL of ["http://8.8.8.8/v1", "http://172.32.0.1/v1", "http://llm.example.com"]) {
      expect(addProvider(EMPTY_REGISTRY, { ...deepseek, baseURL }), baseURL).toEqual({
        ok: false,
        error: "insecure",
      });
    }
    const res = addProvider(EMPTY_REGISTRY, {
      name: "Eigen server",
      api: "openai-compatible",
      baseURL: "http://10.0.0.5:8000/v1",
      noKey: true,
    });
    if (!res.ok) throw new Error(res.error);
    installModelRegistry(res.registry);
    expect(getProvider("eigen-server")).toMatchObject({
      keyEnv: "EIGEN_SERVER_API_KEY",
      keyOptional: true,
    });
  });

  it("never reuses a built-in provider, a local one, or its key (no key goes elsewhere)", () => {
    for (const name of ["OpenAI", "Anthropic", "Ollama", "Claude Code"]) {
      expect(addProvider(EMPTY_REGISTRY, { ...deepseek, name }), name).toEqual({
        ok: false,
        error: "duplicate",
      });
    }
    // "OpenAI compat" would get the built-in OPENAI_COMPAT_API_KEY.
    expect(addProvider(EMPTY_REGISTRY, { ...deepseek, name: "OpenAI compat" })).toEqual({
      ok: false,
      error: "duplicate",
    });
    expect(addProvider(withDeepseek(), deepseek)).toEqual({ ok: false, error: "duplicate" });
  });

  it("once installed it is a provider like the built-in ones, with its own key", () => {
    installModelRegistry(withDeepseek());
    expect(getProvider("deepseek")).toMatchObject({
      name: "DeepSeek",
      api: "openai-compatible",
      baseURL: "https://api.deepseek.com/v1",
      keyEnv: "DEEPSEEK_API_KEY",
    });
    expect(listProviders().map((p) => p.id)).toContain("deepseek");
    expect(listProviders()[0]!.id).toBe("anthropic");
    expect(credentialKeyFor("deepseek")).toBe("DEEPSEEK_API_KEY");
  });

  it("a model can be added on it, and both survive a round trip through storage", () => {
    const res = addModel(withDeepseek(), {
      provider: "deepseek",
      apiId: "deepseek-chat",
      displayName: "DeepSeek Chat",
      supportsImages: false,
      alwaysThinks: false,
      clientSelectable: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const back = parseModelRegistry(JSON.stringify(res.registry));
    expect(back.providers.map((p) => p.id)).toEqual(["deepseek"]);
    expect(back.added.map((m) => m.id)).toEqual(["deepseek/deepseek-chat"]);
  });

  it("storage drops a provider that would shadow a built-in one or reuse its key", () => {
    const stored = {
      added: [],
      lifecycle: {},
      providers: [
        { ...deepseek, id: "openai", keyEnv: "OPENAI_API_KEY" },
        { ...deepseek, id: "sneaky", keyEnv: "ANTHROPIC_API_KEY" },
        { ...deepseek, id: "plain", keyEnv: "PLAIN_API_KEY", baseURL: "http://x.example" },
        { ...deepseek, id: "deepseek", keyEnv: "DEEPSEEK_API_KEY" },
      ],
    };
    expect(parseModelRegistry(JSON.stringify(stored)).providers.map((p) => p.id)).toEqual([
      "deepseek",
    ]);
  });

  it("can be removed while no model uses it", () => {
    const registry = withDeepseek();
    expect(removeProvider(registry, "deepseek")).toMatchObject({ ok: true });
    expect(removeProvider(registry, "anthropic")).toEqual({ ok: false, error: "unknown" });
    const withModel = addModel(registry, {
      provider: "deepseek",
      apiId: "deepseek-chat",
      displayName: "DeepSeek Chat",
      supportsImages: false,
      alwaysThinks: false,
      clientSelectable: true,
    });
    if (!withModel.ok) throw new Error(withModel.error);
    expect(removeProvider(withModel.registry, "deepseek")).toEqual({ ok: false, error: "inUse" });
  });
});
