import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Isolated in-memory SQLite and a connected Anthropic before any server module loads.
process.env.DATABASE_URL = "file::memory:";
process.env.ANTHROPIC_API_KEY = "test-key";
delete process.env.OPENAI_API_KEY;

const { requireRoleMock } = vi.hoisted(() => ({ requireRoleMock: vi.fn() }));
vi.mock("~/server/auth.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/auth.server")>();
  return { ...actual, requireRole: requireRoleMock };
});
vi.mock("~/lib/ai/discover.server", () => ({ discoverLocalModels: vi.fn(async () => []) }));

type Route = typeof import("~/routes/admin.tools");
let route: Route;
let store: typeof import("~/server/modelRegistry.server");
let settings: typeof import("~/server/repositories/settings.server");
let reg: typeof import("~/lib/ai/modelRegistry");

beforeAll(async () => {
  route = await import("~/routes/admin.tools");
  store = await import("~/server/modelRegistry.server");
  settings = await import("~/server/repositories/settings.server");
  reg = await import("~/lib/ai/modelRegistry");
  requireRoleMock.mockImplementation(async () => ({ id: "admin-1", role: "admin" as const }));
});

afterEach(async () => {
  await store.saveModelRegistry(reg.EMPTY_REGISTRY);
  await settings.setEnabledModels(null);
});

function post(fields: Record<string, string>): Request {
  return new Request("http://localhost/admin/tools", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const act = async (fields: Record<string, string>) =>
  (await route.action({ request: post(fields), params: {}, context: {} } as never)) as Record<
    string,
    unknown
  >;

type LoaderData = Awaited<ReturnType<Route["loader"]>>;
const load = async () =>
  (await route.loader({
    request: new Request("http://localhost/admin/tools"),
    params: {},
    context: {},
  } as never)) as LoaderData;

const HAIKU55 = {
  intent: "add",
  provider: "anthropic",
  apiId: "claude-haiku-5-5",
  displayName: "Claude Haiku 5.5",
  alwaysThinks: "on",
  supportsImages: "on",
  clientSelectable: "on",
};

describe("admin.tools models part — admin-only", () => {
  it("the loader and the action check the role", async () => {
    requireRoleMock.mockClear();
    await load();
    await act({ intent: "nothing" });
    expect(requireRoleMock).toHaveBeenCalledTimes(2);
    expect(requireRoleMock.mock.calls.every((c) => c[1] === "admin")).toBe(true);
  });
});

describe("admin.tools models — providers and adding a model", () => {
  it("the loader says which providers are connected, never the key", async () => {
    const data = await load();
    const anthropic = data.providers.find((p) => p.id === "anthropic")!;
    const openai = data.providers.find((p) => p.id === "openai")!;
    expect(anthropic.connected).toBe(true);
    expect(openai).toMatchObject({ connected: false, setting: "OPENAI_API_KEY" });
    expect(JSON.stringify(data)).not.toContain("test-key");
  });

  it("adds a model on a connected provider; it is listed and offered", async () => {
    expect(await act(HAIKU55)).toEqual({ added: "Claude Haiku 5.5" });
    const data = await load();
    expect(data.models.find((m) => m.id === "anthropic/claude-haiku-5-5")).toMatchObject({
      added: true,
      state: "active",
    });
    expect(data.choices.some((c) => c.id === "anthropic/claude-haiku-5-5")).toBe(true);
  });

  it("keeps the effort and temperature chosen on screen", async () => {
    await act({ ...HAIKU55, effort: "high", temperature: "0,2" });
    const { resolveModelInfo } = await import("~/lib/ai/models");
    expect(resolveModelInfo("anthropic/claude-haiku-5-5").settings).toEqual({
      effort: "high",
      temperature: 0.2,
    });
    expect(await act({ ...HAIKU55, apiId: "other", temperature: "9" })).toEqual({
      error: "invalid",
    });
  });

  it("an existing allow-list gets the new model, so it is not hidden by surprise", async () => {
    await settings.setEnabledModels(["claude-sonnet-5-5"]);
    await act(HAIKU55);
    expect(await settings.getEnabledModels()).toEqual([
      "claude-sonnet-5-5",
      "anthropic/claude-haiku-5-5",
    ]);
  });

  it("refuses a provider that is not connected, a duplicate and a bad id", async () => {
    expect(await act({ ...HAIKU55, provider: "openai" })).toEqual({ error: "notConnected" });
    await act(HAIKU55);
    expect(await act(HAIKU55)).toEqual({ error: "duplicate" });
    expect(await act({ ...HAIKU55, apiId: "two words" })).toEqual({ error: "invalid" });
  });
});

describe("admin.tools models — upgrade, finish, undo", () => {
  it("walks Haiku 4.5 to Haiku 5.5 and back", async () => {
    await act(HAIKU55);
    const NEW = "anthropic/claude-haiku-5-5";
    expect(await act({ intent: "upgrade", from: "claude-haiku-4-5", to: NEW })).toEqual({
      upgraded: { name: "Claude Haiku 4.5", successor: "Claude Haiku 5.5" },
    });
    let old = (await load()).models.find((m) => m.id === "claude-haiku-4-5")!;
    expect(old).toMatchObject({ state: "retiring", successor: { id: NEW } });
    // A model on its way out is no longer a choice for the allow-list.
    expect((await load()).choices.some((c) => c.id === "claude-haiku-4-5")).toBe(false);

    expect(await act({ intent: "finish", id: "claude-haiku-4-5" })).toEqual({
      finished: { name: "Claude Haiku 4.5", successor: "Claude Haiku 5.5" },
    });
    old = (await load()).models.find((m) => m.id === "claude-haiku-4-5")!;
    expect(old.state).toBe("retired");

    expect(await act({ intent: "cancel", id: "claude-haiku-4-5" })).toEqual({
      cancelled: { name: "Claude Haiku 4.5", restored: true },
    });
    expect((await load()).models.find((m) => m.id === "claude-haiku-4-5")!.state).toBe("active");
  });

  it("refuses an upgrade to a local model or to itself", async () => {
    expect(await act({ intent: "upgrade", from: "claude-haiku-4-5", to: "claude-code" })).toEqual({
      error: "unknown",
    });
    expect(
      await act({ intent: "upgrade", from: "claude-haiku-4-5", to: "claude-haiku-4-5" }),
    ).toEqual({ error: "self" });
  });

  it("counts where a model is still used", async () => {
    const data = await load();
    const sonnet = data.models.find((m) => m.id === "claude-sonnet-5-5")!;
    // Every registry tool defaults to Sonnet 5.5.
    expect(sonnet.usage.tools).toBeGreaterThan(10);
  });
});

describe("admin.tools models — adding a provider (Aanbieder)", () => {
  const DEEPSEEK = {
    intent: "addProvider",
    name: "DeepSeek",
    api: "openai-compatible",
    baseURL: "https://api.deepseek.com/v1",
    modelsUrl: "https://api-docs.deepseek.com/quick_start/pricing",
  };

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it("adds a provider; it waits for its own key setting in .env", async () => {
    expect(await act(DEEPSEEK)).toEqual({
      providerAdded: { name: "DeepSeek", setting: "DEEPSEEK_API_KEY" },
    });
    const p = (await load()).providers.find((x) => x.id === "deepseek")!;
    expect(p).toMatchObject({
      added: true,
      connected: false,
      setting: "DEEPSEEK_API_KEY",
      baseURL: "https://api.deepseek.com/v1",
    });
    expect(await act({ ...HAIKU55, provider: "deepseek", apiId: "deepseek-chat" })).toEqual({
      error: "notConnected",
    });
  });

  it("with its key set, a model can be added on it", async () => {
    await act(DEEPSEEK);
    process.env.DEEPSEEK_API_KEY = "ds-test";
    expect((await load()).providers.find((x) => x.id === "deepseek")!.connected).toBe(true);
    expect(
      await act({ ...HAIKU55, provider: "deepseek", apiId: "deepseek-chat", displayName: "DS" }),
    ).toEqual({ added: "DS" });
    expect(JSON.stringify(await load())).not.toContain("ds-test");
  });

  it("an intranet server without a key is connected at once", async () => {
    const res = await act({
      intent: "addProvider",
      name: "Eigen server",
      api: "openai-compatible",
      baseURL: "http://10.0.0.5:8000/v1",
      noKey: "on",
    });
    // Nothing to set in .env: the toast says it is ready.
    expect(res).toEqual({ providerAdded: { name: "Eigen server" } });
    expect((await load()).providers.find((x) => x.id === "eigen-server")).toMatchObject({
      connected: true,
      added: true,
    });
  });

  it("refuses http on the internet, a taken name and a bad address", async () => {
    expect(await act({ ...DEEPSEEK, baseURL: "http://api.deepseek.com/v1" })).toEqual({
      error: "insecure",
    });
    expect(await act({ ...DEEPSEEK, name: "OpenAI" })).toEqual({ error: "providerTaken" });
    expect(await act({ ...DEEPSEEK, baseURL: "nope" })).toEqual({ error: "providerInvalid" });
    expect(await act({ ...DEEPSEEK, api: "smtp" })).toEqual({ error: "providerInvalid" });
  });

  it("removes a provider while no model uses it", async () => {
    await act(DEEPSEEK);
    process.env.DEEPSEEK_API_KEY = "ds-test";
    await act({ ...HAIKU55, provider: "deepseek", apiId: "deepseek-chat" });
    expect(await act({ intent: "removeProvider", id: "deepseek" })).toEqual({ error: "inUse" });
    await store.saveModelRegistry({
      ...(await store.getModelRegistry()),
      added: [],
    });
    expect(await act({ intent: "removeProvider", id: "deepseek" })).toEqual({
      providerRemoved: { name: "DeepSeek" },
    });
    expect((await load()).providers.some((x) => x.id === "deepseek")).toBe(false);
    expect(await act({ intent: "removeProvider", id: "anthropic" })).toEqual({
      error: "providerInvalid",
    });
  });
});

describe("admin.tools models — the price of a model (usage dashboard)", () => {
  it("sets a price, shows it on the model, logs it, and removes it again", async () => {
    const audit = await import("~/server/repositories/auditLog.server");
    expect(
      await act({
        intent: "price",
        id: "claude-sonnet-5-5",
        input: "3",
        cacheRead: "0,3",
        cacheWrite: "",
        output: "15",
      }),
    ).toEqual({ priced: { name: "Claude Sonnet 5.5" } });
    const sonnet = (await load()).models.find((m) => m.id === "claude-sonnet-5-5")!;
    expect(sonnet).toMatchObject({
      price: { input: 3, cacheRead: 0.3, output: 15 },
      priceFrom: "admin",
    });
    const [entry] = await audit.listAdminActions(1);
    expect(entry).toMatchObject({
      action: "modelPriceChanged",
      detail: { models: ["claude-sonnet-5-5"], price: { input: 3, cacheRead: 0.3, output: 15 } },
    });

    expect(
      await act({
        intent: "price",
        id: "claude-sonnet-5-5",
        input: "",
        cacheRead: "",
        cacheWrite: "",
        output: "",
      }),
    ).toEqual({ priced: { name: "Claude Sonnet 5.5", cleared: true } });
    // Without an own price, the catalog's list price applies again.
    expect((await load()).models.find((m) => m.id === "claude-sonnet-5-5")).toMatchObject({
      priceFrom: "catalog",
    });
  });

  it("refuses an unknown model and an invalid price", async () => {
    expect(
      await act({
        intent: "price",
        id: "nope",
        input: "1",
        cacheRead: "",
        cacheWrite: "",
        output: "2",
      }),
    ).toEqual({
      error: "unknown",
    });
    expect(
      await act({
        intent: "price",
        id: "claude-sonnet-5-5",
        input: "-1",
        cacheRead: "",
        cacheWrite: "",
        output: "2",
      }),
    ).toEqual({ error: "price" });
  });
});
