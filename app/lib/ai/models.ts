import modelsConfig from "../../../config/models.json";
import {
  type ConfigProvider,
  type ModelInfo,
  type ProviderId,
  parseModelsConfig,
} from "./modelsConfig";
import type { ModelRegistry, ModelState } from "./modelRegistry";

/**
 * Model catalog. Decouples the registry's model ids from raw provider API ids,
 * so swapping or pinning model versions is a one-line change here. Each model
 * names a `provider`; `provider.ts` maps that to a concrete adapter.
 */

export {
  type ConfigProvider,
  LOCAL_PROVIDERS,
  type ModelInfo,
  type ModelSettings,
  type ModelsConfig,
  parseModelsConfig,
  type ProviderId,
} from "./modelsConfig";

const config = parseModelsConfig(modelsConfig);

/**
 * The built-in catalog, read from `config/models.json` (edit that file, not this code, to
 * add or change a model; restart or rebuild to apply). Models an admin adds on screen
 * come on top of it through `installModelRegistry`.
 */
export const MODELS: Readonly<Record<string, ModelInfo>> = Object.fromEntries(
  config.models.map(({ id, ...info }) => [id, info]),
);

/** Dictation's provider and model (`speechToText` in `config/models.json`), or null. */
export const SPEECH_TO_TEXT: Readonly<{ provider: string; model: string }> | null =
  config.speechToText ?? null;

/** The API providers of `config/models.json`, in file order. */
export const PROVIDERS: readonly ConfigProvider[] = config.providers;

/** A provider of the config or one the admin added (installed with the registry). */
export function getProvider(id: string): ConfigProvider | undefined {
  return PROVIDERS.find((p) => p.id === id) ?? addedProviders.find((p) => p.id === id);
}

/** Every API provider: the config's first, then the ones the admin added. */
export function listProviders(): ConfigProvider[] {
  return [...PROVIDERS, ...addedProviders];
}

export type ModelId = string;

/** Answer budget when a tool sets none. */
export const DEFAULT_MAX_TOKENS = 8192;

/**
 * Extra output tokens for a model that always thinks. Thinking is billed when it
 * happens, so the headroom costs nothing unless the model uses it; without it a
 * long think leaves no room for the answer.
 */
export const THINKING_HEADROOM = 16000;

/** maxOutputTokens to send: the tool's answer budget, plus thinking room where the model always thinks. */
export function outputTokenBudget(
  info: Pick<ModelInfo, "alwaysThinks">,
  maxTokens?: number,
): number {
  const answer = maxTokens ?? DEFAULT_MAX_TOKENS;
  return info.alwaysThinks ? answer + THINKING_HEADROOM : answer;
}

/** The app-wide default model (`default` in `config/models.json`). */
export const DEFAULT_MODEL: ModelId = config.default;

// ── The admin's registry (added models, upgrades), installed by the server ─────────
// `modelRegistry.server` reads it from the database and installs it here, so every
// lookup below sees added and retiring models without a second code path.
let installed: ModelRegistry = { added: [], lifecycle: {}, providers: [] };
let addedById = new Map<string, ModelInfo>();
let addedProviders: ConfigProvider[] = [];

/** Install the admin's registry (server only; tests reset it with the empty one). */
export function installModelRegistry(registry: ModelRegistry): void {
  installed = registry;
  // A config provider always wins: an added one can never shadow it.
  addedProviders = registry.providers
    .filter((p) => !PROVIDERS.some((c) => c.id === p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      api: p.api,
      baseURL: p.baseURL,
      keyEnv: p.keyEnv,
      ...(p.keyOptional ? { keyOptional: true } : {}),
      ...(p.modelsUrl ? { modelsUrl: p.modelsUrl } : {}),
      example: "",
      // Claude's API caches only what is marked; an own OpenAI-style server by itself.
      cache: p.api === "anthropic" ? "markers" : "auto",
    }));
  addedById = new Map(
    registry.added
      // A catalog id always wins: an added model can never shadow a built-in one.
      .filter((m) => !(m.id in MODELS))
      .map((m) => [
        m.id,
        {
          provider: m.provider,
          apiId: m.apiId,
          displayName: m.displayName,
          supportsImages: m.supportsImages,
          alwaysThinks: m.alwaysThinks,
          clientSelectable: m.clientSelectable,
          tier: 2 as const,
          ...(m.settings ? { settings: m.settings } : {}),
        },
      ]),
  );
}

/** The installed registry (read-only view for the admin screen). */
export function installedModelRegistry(): ModelRegistry {
  return installed;
}

/** Where a model is in its life: active, retiring (upgraded) or retired. */
export function modelState(id: string): ModelState {
  return installed.lifecycle[id]?.state ?? "active";
}

/** Follow the upgrade chain from `id`, retiring or retired, to the model for new work. */
export function currentModelId(id: string): string {
  let current = id;
  const seen = new Set<string>();
  let step = installed.lifecycle[current];
  while (step && !seen.has(current)) {
    seen.add(current);
    current = step.successor;
    step = installed.lifecycle[current];
  }
  return current;
}

/**
 * The model to serve for a request that names `id`: a retiring model still serves (a
 * running conversation finishes on it), a retired one hands over to its successor.
 */
export function forwardRetired(id: string): string {
  return modelState(id) === "retired" ? currentModelId(id) : id;
}

function staticOrAdded(id: string): ModelInfo | undefined {
  return (MODELS as Record<string, ModelInfo>)[id] ?? addedById.get(id);
}

export function getModel(id: string): ModelInfo {
  const info = staticOrAdded(id);
  if (!info) throw new Error(`Unknown model id: ${id}`);
  return info;
}

/** Separator for dynamically-discovered local model ids: "<provider>::<apiId>". */
const DYNAMIC_SEP = "::";
const DYNAMIC_PROVIDERS: Record<string, ProviderId> = {
  ollama: "ollama",
  lmstudio: "lmstudio",
};

/** Build a runtime id for a discovered local model, e.g. "ollama::gemma4:31b". */
export function dynamicModelId(provider: "ollama" | "lmstudio", apiId: string): string {
  return `${provider}${DYNAMIC_SEP}${apiId}`;
}

function parseDynamicModel(id: string): ModelInfo | null {
  const idx = id.indexOf(DYNAMIC_SEP);
  if (idx === -1) return null;
  const provider = DYNAMIC_PROVIDERS[id.slice(0, idx)];
  const apiId = id.slice(idx + DYNAMIC_SEP.length);
  if (!provider || !apiId) return null;
  // Local inference is free to the owner, so discovered models stay selectable.
  return {
    provider,
    apiId,
    displayName: apiId,
    supportsImages: false,
    tier: 2,
    local: true,
    clientSelectable: true,
  };
}

/** Prefix for a configured OpenAI-compatible endpoint model, e.g. "compat::glm-4-plus". */
const COMPAT_PREFIX = `openai-compat${DYNAMIC_SEP}`;
const COMPAT_ALIAS = `compat${DYNAMIC_SEP}`;

/**
 * Resolve a configured OpenAI-compatible model id ("compat::<apiId>"). The
 * endpoint (base URL + optional key) lives in `.env`; this only carries the raw
 * model id. Unlike local models it is a PAID remote model, so it is NOT
 * client-selectable — reachable as a configured default (e.g. the summary
 * sweep's `--model`), never forced from a request body.
 */
function parseCompatModel(id: string): ModelInfo | null {
  const apiId = id.startsWith(COMPAT_PREFIX)
    ? id.slice(COMPAT_PREFIX.length)
    : id.startsWith(COMPAT_ALIAS)
      ? id.slice(COMPAT_ALIAS.length)
      : null;
  if (!apiId) return null;
  return {
    provider: "openai-compat",
    apiId,
    displayName: apiId,
    supportsImages: false,
    tier: 2,
    local: false,
    clientSelectable: false,
  };
}

/**
 * Resolve a model id to its ModelInfo: the static catalog first, then a
 * dynamically-discovered local id ("<provider>::<apiId>"), then a configured
 * OpenAI-compatible endpoint ("compat::<apiId>"). Throws if none.
 */
export function resolveModelInfo(id: string): ModelInfo {
  return staticOrAdded(id) ?? parseDynamicModel(id) ?? parseCompatModel(id) ?? throwUnknown(id);
}

function throwUnknown(id: string): never {
  throw new Error(`Unknown model id: ${id}`);
}

/** Whether an id resolves to a usable model (catalog, dynamic local, or configured compat). */
export function isResolvableModel(id: string): boolean {
  return (
    staticOrAdded(id) !== undefined ||
    parseDynamicModel(id) !== null ||
    parseCompatModel(id) !== null
  );
}

/**
 * Whether a caller may force this model via the request body. Guards the owner's
 * bill: expensive API models (Opus) are excluded, so a hostile body can only
 * ever downgrade to a selectable model, never up. Unknown ids are not selectable.
 * Phase 4 swaps this body for an admin-configured allow-list.
 */
export function isClientSelectable(id: string): boolean {
  const info = staticOrAdded(id) ?? parseDynamicModel(id) ?? parseCompatModel(id);
  return info?.clientSelectable === true;
}

/** The catalog plus the admin's added models, in every state (filter on `modelState`). */
export function listModels(): Array<{ id: string } & ModelInfo> {
  return [...(Object.entries(MODELS) as Array<[string, ModelInfo]>), ...addedById.entries()].map(
    ([id, info]) => ({ id, ...info }),
  );
}

/** Minimal shape needed to render a model <option> (static catalog or discovered local). */
export interface PickerModel {
  id: string;
  displayName: string;
  supportsImages?: boolean;
  /** Reasoning model whose thinking can be toggled off (drives the chat toggle). */
  supportsThinking?: boolean;
}

/**
 * The single source of truth for the model picker on EVERY screen: a catalog of
 * choosable models plus any local models discovered at runtime (Ollama / LM
 * Studio). When `requiresImages` is set (e.g. the handwritten-math tool) the list
 * is narrowed to vision-capable models.
 *
 * `catalog` lets a loader supply the admin-configured allow-list (Phase 4) rather
 * than the whole client-selectable catalog. Omitted → the static client-selectable
 * catalog, i.e. the pre-Phase-4 behaviour (so component tests need no wiring).
 */
export function pickableModels(
  localModels: PickerModel[] = [],
  requiresImages = false,
  catalog?: PickerModel[],
): PickerModel[] {
  // Never offer a model the server would silently swap: default to the catalog's
  // client-selectable entries. Discovered local models are free and always shown.
  const base =
    catalog ?? listModels().filter((m) => m.clientSelectable && modelState(m.id) === "active");
  const all: PickerModel[] = [...base, ...localModels];
  // A vision tool must only offer models KNOWN to support images: an unknown
  // (undefined) flag is treated as non-vision, not waved through.
  return requiresImages ? all.filter((m) => m.supportsImages === true) : all;
}

/**
 * The model a picker should pre-select: an explicit choice if it is offered, else
 * the tool's default if offered, else the first offered model. Keeps the initial
 * selection INSIDE the offered set, so a teacher whose set holds only a local model
 * never pre-selects (and then sends) the tool's frontier default that was
 * disabled for them. Falls back to `toolDefault` only when nothing is offered at all.
 */
export function initialPickerModel(
  options: PickerModel[],
  toolDefault: string,
  explicit?: string,
): string {
  const has = (id: string | undefined): id is string => !!id && options.some((m) => m.id === id);
  if (has(explicit)) return explicit;
  if (has(toolDefault)) return toolDefault;
  return options[0]?.id ?? toolDefault;
}
