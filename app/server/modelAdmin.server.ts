/**
 * The admin's models page, server side: which providers are connected, every API
 * model with its state and use, and the actions (add, upgrade, finish, undo). Keys
 * never leave the server: a provider is "connected" when its setting is present.
 */
import { ALL_TOOLS } from "~/lib/registry";
import {
  listModels,
  modelState,
  resolveModelInfo,
  type ModelInfo,
  type ModelSettings,
} from "~/lib/ai/models";
import { discoverLocalModels } from "~/lib/ai/discover.server";
import {
  addModel,
  addProvider,
  cancelUpgrade,
  removeProvider,
  finishUpgrade,
  startUpgrade,
  type AddModelInput,
  type AddProviderInput,
  type ModelState,
} from "~/lib/ai/modelRegistry";
import {
  addableProviders,
  type AddableProvider,
  getAddableProvider,
  isAddableProvider,
} from "~/lib/ai/providers";
import type { LocalizedText } from "~/lib/i18n/localized";
import { localModelsEnabled, providerSetting } from "./env.server";
import { getModelRegistry, saveModelRegistry } from "./modelRegistry.server";
import { fullCatalog } from "./modelCatalog.server";
import { getEnabledModels, setEnabledModels } from "./repositories/settings.server";
import { countGenerationsByModel } from "./repositories/generations.server";
import { listAssignedModelSets } from "./repositories/users.server";
import { listTeams } from "./repositories/teams.server";
import { recordAdminAction } from "./repositories/auditLog.server";

export interface ProviderStatus {
  id: string;
  name: LocalizedText;
  connected: boolean;
  /** The server setting it needs (a name, never a value). */
  setting: string;
  modelsUrl?: string;
  example: string;
  /** Added on this screen (can be removed while no model uses it). */
  added: boolean;
  /** The address it is reached at (not a secret; shown so the admin can check it). */
  baseURL?: string;
}

export interface ModelUsage {
  /** Results in the last 30 days. */
  results: number;
  /** Teachers whose own set names it. */
  people: number;
  teams: number;
  /** Tools (or stages) with it as their default. */
  tools: number;
}

export interface AdminModelRow {
  id: string;
  displayName: string;
  providerName: LocalizedText;
  added: boolean;
  state: ModelState;
  successor: { id: string; displayName: string } | null;
  usage: ModelUsage;
}

/** The setting a provider still needs: its address (own endpoint) first, then its key. */
function missingSetting(p: AddableProvider): string | null {
  if (!p.baseURL && p.baseURLEnv && !providerSetting(p.baseURLEnv)) return p.baseURLEnv;
  if (!p.keyOptional && !providerSetting(p.keyEnv)) return p.keyEnv;
  return null;
}

function isConnected(id: string): boolean {
  const p = getAddableProvider(id);
  return p !== undefined && missingSetting(p) === null;
}

export async function providerStatuses(): Promise<ProviderStatus[]> {
  const added = new Set((await getModelRegistry()).providers.map((p) => p.id));
  return addableProviders().map((p) => ({
    id: p.id,
    name: p.name,
    connected: missingSetting(p) === null,
    setting: missingSetting(p) ?? p.keyEnv,
    ...(p.modelsUrl ? { modelsUrl: p.modelsUrl } : {}),
    example: p.example,
    added: added.has(p.id),
    ...(p.baseURL ? { baseURL: p.baseURL } : {}),
  }));
}

const providerName = (info: ModelInfo): LocalizedText =>
  getAddableProvider(info.provider)?.name ?? info.provider;

/** API models (no CLI agents, no local servers): the ones that have versions to manage. */
function apiModels() {
  return listModels().filter((m) => !m.local);
}

function tally(ids: Iterable<string>, into: Map<string, number>) {
  for (const id of new Set(ids)) into.set(id, (into.get(id) ?? 0) + 1);
}

export async function adminModelRows(): Promise<AdminModelRow[]> {
  const registry = await getModelRegistry();
  const results = new Map(
    (await countGenerationsByModel(30)).map((r) => [r.model, Number(r.count)]),
  );
  const people = new Map<string, number>();
  for (const set of await listAssignedModelSets()) tally(set, people);
  const teams = new Map<string, number>();
  for (const team of await listTeams()) tally(team.settings.models ?? [], teams);
  const tools = new Map<string, number>();
  for (const tool of ALL_TOOLS) {
    tally([tool.defaultModel, ...tool.stages.flatMap((s) => (s.model ? [s.model] : []))], tools);
  }
  const added = new Set(registry.added.map((m) => m.id));
  return apiModels().map((m) => {
    const entry = registry.lifecycle[m.id];
    return {
      id: m.id,
      displayName: m.displayName,
      providerName: providerName(m),
      added: added.has(m.id),
      state: modelState(m.id),
      successor: entry
        ? { id: entry.successor, displayName: resolveModelInfo(entry.successor).displayName }
        : null,
      usage: {
        results: results.get(m.id) ?? 0,
        people: people.get(m.id) ?? 0,
        teams: teams.get(m.id) ?? 0,
        tools: tools.get(m.id) ?? 0,
      },
    };
  });
}

export type AddResult = { added: string } | { error: string };

/** Add a model on a connected provider. An existing allow-list gets it too (no surprise). */
export async function addAdminModel(input: AddModelInput): Promise<AddResult> {
  if (!getAddableProvider(input.provider)) return { error: "invalid" };
  if (!isConnected(input.provider)) return { error: "notConnected" };
  const res = addModel(await getModelRegistry(), input);
  if (!res.ok) return { error: res.error };
  await saveModelRegistry(res.registry);
  const enabled = await getEnabledModels();
  if (enabled !== null && enabled.length > 0) await setEnabledModels([...enabled, res.id]);
  return { added: input.displayName.trim() };
}

export type ProviderResult =
  | { providerAdded: { name: string; setting?: string } }
  | { providerRemoved: { name: string } }
  | { error: string };

/** Provider errors get their own toast texts (a model's "duplicate" reads wrong here). */
const PROVIDER_ERROR = {
  invalid: "providerInvalid",
  insecure: "insecure",
  duplicate: "providerTaken",
  unknown: "providerInvalid",
  inUse: "inUse",
} as const;

/** Add a provider: its key setting is derived from its name and stays in `.env`. */
export async function addAdminProvider(input: AddProviderInput): Promise<ProviderResult> {
  const res = addProvider(await getModelRegistry(), input);
  if (!res.ok) return { error: PROVIDER_ERROR[res.error] };
  await saveModelRegistry(res.registry);
  const name = input.name.trim();
  // An own server without a key is ready at once; otherwise name the setting to add.
  return { providerAdded: input.noKey ? { name } : { name, setting: res.keyEnv } };
}

export async function removeAdminProvider(id: string): Promise<ProviderResult> {
  const registry = await getModelRegistry();
  const name = registry.providers.find((p) => p.id === id)?.name ?? id;
  const res = removeProvider(registry, id);
  if (!res.ok) return { error: PROVIDER_ERROR[res.error] };
  await saveModelRegistry(res.registry);
  return { providerRemoved: { name } };
}

const nameOf = (id: string) => resolveModelInfo(id).displayName;
const isApiModel = (id: string) => apiModels().some((m) => m.id === id);

export type UpgradeResult =
  | { upgraded: { name: string; successor: string } }
  | { finished: { name: string; successor: string } }
  | { cancelled: { name: string; restored: boolean } }
  | { error: string };

export async function upgradeAdminModel(from: string, to: string): Promise<UpgradeResult> {
  const registry = await getModelRegistry();
  const res = startUpgrade(registry, from, to, isApiModel);
  if (!res.ok) return { error: res.error };
  await saveModelRegistry(res.registry);
  return { upgraded: { name: nameOf(from), successor: nameOf(to) } };
}

export async function finishAdminUpgrade(id: string): Promise<UpgradeResult> {
  const registry = await getModelRegistry();
  const res = finishUpgrade(registry, id);
  if (!res.ok) return { error: res.error };
  await saveModelRegistry(res.registry);
  return {
    finished: { name: nameOf(id), successor: nameOf(registry.lifecycle[id].successor) },
  };
}

export async function cancelAdminUpgrade(id: string): Promise<UpgradeResult> {
  const registry = await getModelRegistry();
  const wasRetired = registry.lifecycle[id]?.state === "retired";
  const res = cancelUpgrade(registry, id);
  if (!res.ok) return { error: res.error };
  await saveModelRegistry(res.registry);
  return { cancelled: { name: nameOf(id), restored: wasRetired } };
}

export interface LocalOverview {
  /** Local models exist only outside production (`localModelsEnabled`). */
  enabled: boolean;
  /** The CLI agents in `config/models.json`. */
  agents: { id: string; displayName: string }[];
  /** Ollama and LM Studio: how many models were found running just now. */
  servers: { id: "ollama" | "lmstudio"; name: string; found: number }[];
}

/** The CLI agents and local servers: shown always, usable only outside production. */
async function localOverview(): Promise<LocalOverview> {
  const enabled = localModelsEnabled();
  const found = enabled ? await discoverLocalModels() : [];
  const count = (p: string) => found.filter((m) => m.provider === p).length;
  return {
    enabled,
    agents: listModels()
      .filter((m) => m.local)
      .map((m) => ({ id: m.id, displayName: m.displayName })),
    servers: [
      { id: "ollama", name: "Ollama", found: count("ollama") },
      { id: "lmstudio", name: "LM Studio", found: count("lmstudio") },
    ],
  };
}

/** Everything the models part of the admin page shows. */
export async function modelAdminData() {
  // Instance model allow-list (P14/P18): `null` stored = every model is on.
  const enabled = await getEnabledModels();
  const choices = (await fullCatalog()).map((m) => ({
    ...m,
    checked: enabled === null || enabled.includes(m.id),
  }));
  return {
    providers: await providerStatuses(),
    models: await adminModelRows(),
    choices,
    local: await localOverview(),
  };
}

/** The intents of the models part. */
export const MODEL_INTENTS = [
  "models",
  "add",
  "upgrade",
  "finish",
  "cancel",
  "addProvider",
  "removeProvider",
] as const;
export type ModelIntent = (typeof MODEL_INTENTS)[number];

export function isModelIntent(intent: string): intent is ModelIntent {
  return (MODEL_INTENTS as readonly string[]).includes(intent);
}

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

/** Effort and temperature from the add form; empty = the provider's default. */
function addedSettings(fd: FormData): { settings?: ModelSettings } {
  const settings: ModelSettings = {};
  const effort = text(fd, "effort");
  if ((EFFORTS as readonly string[]).includes(effort)) {
    settings.effort = effort as ModelSettings["effort"];
  }
  const temp = text(fd, "temperature").replace(",", ".");
  if (temp !== "") {
    const n = Number(temp);
    // Out of range is refused by the registry's own check (an "invalid" toast).
    settings.temperature = Number.isFinite(n) ? n : -1;
  }
  return Object.keys(settings).length ? { settings } : {};
}

/**
 * Run one models intent from the admin page's form data (the caller checked the role). A change
 * to the instance's model choice goes in the audit log under `actorUserId`.
 */
export async function modelAdminAction(intent: ModelIntent, fd: FormData, actorUserId: string) {
  switch (intent) {
    case "models": {
      const catalogIds = new Set((await fullCatalog()).map((m) => m.id));
      const chosen = [...new Set(fd.getAll("models").map(String))].filter((id) =>
        catalogIds.has(id),
      );
      // Lockout guard at the boundary: an admin may not unselect everything.
      if (chosen.length === 0) return { error: true as const };
      await setEnabledModels(chosen);
      await recordAdminAction({
        actorUserId,
        action: "instanceModelsChanged",
        detail: { models: chosen },
      });
      return { saved: true as const };
    }
    case "add": {
      const provider = text(fd, "provider");
      if (!isAddableProvider(provider)) return { error: "invalid" };
      return addAdminModel({
        provider,
        apiId: text(fd, "apiId"),
        displayName: text(fd, "displayName"),
        supportsImages: fd.get("supportsImages") === "on",
        alwaysThinks: fd.get("alwaysThinks") === "on",
        clientSelectable: fd.get("clientSelectable") === "on",
        ...addedSettings(fd),
      });
    }
    case "upgrade":
      return upgradeAdminModel(text(fd, "from"), text(fd, "to"));
    case "finish":
      return finishAdminUpgrade(text(fd, "id"));
    case "cancel":
      return cancelAdminUpgrade(text(fd, "id"));
    case "addProvider": {
      const api = text(fd, "api");
      if (api !== "anthropic" && api !== "openai-compatible") return { error: "providerInvalid" };
      return addAdminProvider({
        name: text(fd, "name"),
        api,
        baseURL: text(fd, "baseURL"),
        modelsUrl: text(fd, "modelsUrl"),
        noKey: fd.get("noKey") === "on",
      });
    }
    case "removeProvider":
      return removeAdminProvider(text(fd, "id"));
  }
}
