/**
 * Editing and removing a model the admin added on screen: its name, effort, temperature and
 * switches can change; it can go while nothing has used or names it. A used model is phased
 * out with an upgrade instead, so old results keep their model.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.DATABASE_URL = "file::memory:";
process.env.ANTHROPIC_API_KEY = "test-key";

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
  await settings.setDefaultModel(null);
});

const act = async (fields: Record<string, string>) =>
  (await route.action({
    request: new Request("http://localhost/admin/tools", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    }),
    params: {},
    context: {},
  } as never)) as Record<string, unknown>;

const load = async () =>
  (await route.loader({
    request: new Request("http://localhost/admin/tools"),
    params: {},
    context: {},
  } as never)) as Awaited<ReturnType<Route["loader"]>>;

const ID = "anthropic/minimax-test";
const ADD = {
  intent: "add",
  provider: "anthropic",
  apiId: "minimax-test",
  displayName: "MiniMax test",
  clientSelectable: "on",
  temperature: "0.7",
};

describe("editing an added model", () => {
  it("changes its name, effort, temperature and switches; the loader shows them", async () => {
    await act(ADD);
    expect(
      await act({
        intent: "edit",
        id: ID,
        displayName: "MiniMax M3.1 Flash",
        effort: "high",
        temperature: "0,3",
        supportsImages: "on",
      }),
    ).toEqual({ edited: "MiniMax M3.1 Flash" });
    const { resolveModelInfo } = await import("~/lib/ai/models");
    expect(resolveModelInfo(ID)).toMatchObject({
      displayName: "MiniMax M3.1 Flash",
      supportsImages: true,
      alwaysThinks: false,
      clientSelectable: false,
      settings: { effort: "high", temperature: 0.3 },
    });
    expect((await load()).models.find((m) => m.id === ID)).toMatchObject({
      added: true,
      config: {
        supportsImages: true,
        alwaysThinks: false,
        clientSelectable: false,
        settings: { effort: "high", temperature: 0.3 },
      },
    });
  });

  it("an empty temperature and effort go back to the provider's default", async () => {
    await act({ ...ADD, effort: "low" });
    await act({ intent: "edit", id: ID, displayName: "MiniMax test", clientSelectable: "on" });
    const { resolveModelInfo } = await import("~/lib/ai/models");
    expect(resolveModelInfo(ID).settings).toBeUndefined();
  });

  it("logs the change", async () => {
    const audit = await import("~/server/repositories/auditLog.server");
    await act(ADD);
    await act({ intent: "edit", id: ID, displayName: "Nieuw", clientSelectable: "on" });
    expect((await audit.listAdminActions(1))[0]).toMatchObject({
      action: "modelEdited",
      detail: { models: [ID] },
    });
  });

  it("refuses a model from the config, an unknown one and invalid values", async () => {
    await act(ADD);
    expect(await act({ intent: "edit", id: "claude-sonnet-5-5", displayName: "X" })).toEqual({
      error: "notAdded",
    });
    expect(await act({ intent: "edit", id: "anthropic/nope", displayName: "X" })).toEqual({
      error: "notAdded",
    });
    expect(await act({ intent: "edit", id: ID, displayName: "" })).toEqual({ error: "invalid" });
    expect(await act({ intent: "edit", id: ID, displayName: "X", temperature: "5" })).toEqual({
      error: "invalid",
    });
  });
});

describe("removing an added model", () => {
  it("removes an unused model: gone from the list, the allow-list and its price", async () => {
    const audit = await import("~/server/repositories/auditLog.server");
    const prices = await import("~/server/repositories/modelPrices.server");
    await settings.setEnabledModels(["claude-sonnet-5-5"]);
    await act(ADD);
    await prices.setModelPrice(ID, { input: 0.15, output: 0.6 });
    expect(await act({ intent: "remove", id: ID })).toEqual({ removed: "MiniMax test" });
    const data = await load();
    expect(data.models.some((m) => m.id === ID)).toBe(false);
    expect(await settings.getEnabledModels()).toEqual(["claude-sonnet-5-5"]);
    expect((await prices.getModelPrices())[ID]).toBeUndefined();
    expect((await audit.listAdminActions(1))[0]).toMatchObject({
      action: "modelRemoved",
      detail: { models: [ID] },
    });
  });

  it("keeps a model that has results or calls: old work keeps its model", async () => {
    // Its own id: a counted call stays in the shared database.
    const usage = await import("~/server/repositories/aiUsage.server");
    const used = "anthropic/minimax-used";
    await act({ ...ADD, apiId: "minimax-used" });
    await usage.recordAiUsage("someone", { source: "x", model: used });
    expect(await act({ intent: "remove", id: used })).toEqual({ error: "used" });
    expect((await load()).models.some((m) => m.id === used)).toBe(true);
  });

  it("keeps a model that is still named somewhere", async () => {
    const users = await import("~/server/repositories/users.server");
    const teams = await import("~/server/repositories/teams.server");
    await act(ADD);

    await settings.setDefaultModel(ID);
    expect(await act({ intent: "remove", id: ID })).toEqual({ error: "named" });
    await settings.setDefaultModel(null);

    await users.setUserExtraModels("t-1", [ID]);
    expect(await act({ intent: "remove", id: ID })).toEqual({ error: "named" });
    await users.setUserExtraModels("t-1", null);

    const team = await teams.createTeam("Edit team");
    await teams.setTeamSettings(team.id, { features: {}, tools: {}, models: [ID] });
    expect(await act({ intent: "remove", id: ID })).toEqual({ error: "named" });
    await teams.setTeamSettings(team.id, { features: {}, tools: {}, models: null });

    expect(await act({ intent: "remove", id: ID })).toEqual({ removed: "MiniMax test" });
  });

  it("keeps a model that is part of an upgrade", async () => {
    await act(ADD);
    await act({ intent: "upgrade", from: "claude-haiku-4-5", to: ID });
    expect(await act({ intent: "remove", id: ID })).toEqual({ error: "upgrading" });
    await act({ intent: "cancel", id: "claude-haiku-4-5" });
  });

  it("refuses a model from the config", async () => {
    expect(await act({ intent: "remove", id: "claude-sonnet-5-5" })).toEqual({
      error: "notAdded",
    });
  });
});
