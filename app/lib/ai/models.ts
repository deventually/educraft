import { z } from "zod";
import modelsConfig from "../../../config/models.json";
import type { ModelRegistry, ModelState } from "./modelRegistry";

/**
 * Model catalog. Decouples the registry's model ids from raw provider API ids,
 * so swapping or pinning model versions is a one-line change here. Each model
 * names a `provider`; `provider.ts` maps that to a concrete adapter.
 */

/**
 * A provider id: one from `providers` in `config/models.json` (an API with a key on the
 * server), or a built-in local kind below (no key; only outside production).
 */
export type ProviderId = string;

/** Local servers and CLI agents: built in, because they need code, not a key. */
export const LOCAL_PROVIDERS = [
  "ollama",
  "lmstudio",
  "claude-code",
  "opencode",
  "codex",
  "gemini-cli",
] as const;

/** How a model answers: the effort it puts in, its temperature, its answer length. */
export interface ModelSettings {
  /** Sampling temperature; `null` = never send one (reasoning models that refuse it). */
  temperature?: number | null;
  /** Reasoning effort, for providers that support it (Claude, GPT, …). */
  effort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  /** Answer budget when a tool sets none. */
  maxTokens?: number;
}

export interface ModelInfo {
  provider: ProviderId;
  /** Raw id passed to the provider SDK. */
  apiId: string;
  /** NL/EN display name shown in the UI. */
  displayName: string;
  supportsImages: boolean;
  /**
   * Whether the model reasons ("thinks") before answering and can be told NOT to
   * (Ollama's `think` switch). Detected at discovery from `/api/show` capabilities.
   * Drives the chat UI's "thinking" toggle; only ever set for local models.
   */
  supportsThinking?: boolean;
  /**
   * The model always reasons before it answers (Claude 5.x adaptive thinking), and
   * that reasoning counts toward maxOutputTokens. The adapter adds
   * {@link THINKING_HEADROOM} on top of the tool's budget so the answer itself
   * still fits (second measurement 2026-11-04: an empty answer at 6144).
   */
  alwaysThinks?: boolean;
  /** Rough ordering for the model picker (lower = lighter/cheaper). */
  tier: 1 | 2 | 3;
  /** Local provider (runs on the user's machine; no API key). */
  local?: boolean;
  /**
   * May a client force this model via the request body? Expensive API models
   * (Opus-class) are reachable only as a tool/stage default, never selectable by
   * a caller, so a malicious body can't run up the owner's bill. Local/CLI models
   * cost the owner nothing, so they stay selectable. Phase 4 turns this hardcoded
   * flag into the default for an admin-configurable list — the check stays in the
   * single `isClientSelectable()` / `pickableModels()` surface so only the
   * implementation changes.
   */
  clientSelectable: boolean;
  /** How the model answers (`settings` in `config/models.json`). */
  settings?: ModelSettings;
}

const LocalizedNameSchema = z.union([
  z.string().min(1),
  z.object({ nl: z.string().min(1), en: z.string().min(1) }),
]);

/** Only names of server settings may be given, never values (keys stay in `.env`). */
const SETTING_NAME = /^[A-Z][A-Z0-9_]*_(API_KEY|BASE_URL)$/;

const ConfigProviderSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: LocalizedNameSchema,
    /** "anthropic" = Anthropic's own API; "openai-compatible" = the OpenAI chat API. */
    api: z.enum(["anthropic", "openai-compatible"]),
    /** The provider's address (for Anthropic: its API root). */
    baseURL: z.url().optional(),
    /** A server setting that overrides the address (a proxy, an EU region, an own endpoint). */
    baseURLEnv: z.string().regex(SETTING_NAME).optional(),
    keyEnv: z.string().regex(SETTING_NAME),
    keyOptional: z.boolean().optional(),
    modelsUrl: z.url().optional(),
    example: z.string().min(1),
  })
  .refine((p) => p.api === "anthropic" || p.baseURL || p.baseURLEnv, {
    message: "an openai-compatible provider needs baseURL or baseURLEnv",
  });

export type ConfigProvider = z.infer<typeof ConfigProviderSchema>;

const SettingsSchema = z.object({
  temperature: z.number().min(0).max(2).nullable().optional(),
  effort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).optional(),
  maxTokens: z.int().min(256).max(200_000).optional(),
});

const ConfigModelSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  apiId: z.string().min(1),
  displayName: z.string().min(1),
  supportsImages: z.boolean(),
  supportsThinking: z.boolean().optional(),
  alwaysThinks: z.boolean().optional(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  local: z.boolean().optional(),
  clientSelectable: z.boolean(),
  settings: SettingsSchema.optional(),
});

/**
 * Dictation (speech to text): an OpenAI-compatible provider with a transcription model
 * (`/audio/transcriptions`), e.g. whisper.cpp's `whisper-server` on the school network,
 * or OpenAI. Absent = no dictation.
 */
const SpeechToTextSchema = z.object({
  provider: z.string().min(1),
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/),
});

const ModelsConfigSchema = z.object({
  default: z.string().min(1),
  providers: z.array(ConfigProviderSchema).default([]),
  models: z.array(ConfigModelSchema).min(1),
  speechToText: SpeechToTextSchema.optional(),
});

export type ModelsConfig = z.infer<typeof ModelsConfigSchema>;

/**
 * Validate `config/models.json`. A broken file stops the app at boot with a message that
 * names the file and the problem, instead of failing on the first AI call.
 */
export function parseModelsConfig(raw: unknown): ModelsConfig {
  const res = ModelsConfigSchema.safeParse(raw);
  if (!res.success) {
    const where = res.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`config/models.json is invalid (check provider, tier, fields): ${where}`);
  }
  const providerIds = new Set<string>(LOCAL_PROVIDERS);
  for (const p of res.data.providers) {
    if (providerIds.has(p.id)) {
      throw new Error(`config/models.json: provider "${p.id}" is listed twice.`);
    }
    providerIds.add(p.id);
  }
  const seen = new Set<string>();
  for (const m of res.data.models) {
    if (!providerIds.has(m.provider)) {
      throw new Error(
        `config/models.json: model "${m.id}" names provider "${m.provider}", which is not in "providers".`,
      );
    }
    if (seen.has(m.id)) throw new Error(`config/models.json: model "${m.id}" is listed twice.`);
    seen.add(m.id);
  }
  if (!seen.has(res.data.default)) {
    throw new Error(`config/models.json: the default "${res.data.default}" is not in the list.`);
  }
  // A provider added on screen is only known at run time; a listed one must speak OpenAI.
  const stt = res.data.speechToText;
  const sttProvider = stt && res.data.providers.find((p) => p.id === stt.provider);
  if (
    stt &&
    ((LOCAL_PROVIDERS as readonly string[]).includes(stt.provider) ||
      (sttProvider && sttProvider.api !== "openai-compatible"))
  ) {
    throw new Error(
      `config/models.json: speechToText needs an openai-compatible provider, not "${stt.provider}".`,
    );
  }
  return res.data;
}

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
