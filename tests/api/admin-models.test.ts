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
