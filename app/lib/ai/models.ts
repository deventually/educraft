/**
 * Model catalog. Decouples the registry's model ids from raw provider API ids,
 * so swapping or pinning model versions is a one-line change here. Each model
 * names a `provider`; `provider.ts` maps that to a concrete adapter.
 */

export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "mistral"
  // A configured OpenAI-compatible endpoint (base URL + optional key in .env):
  // covers ChatGPT, Gemini, Mistral, GLM, DeepSeek, OpenRouter, vLLM, … — any
  // frontier or self-hosted model that speaks the OpenAI API.
  | "openai-compat"
  | "ollama"
  | "lmstudio"
  // Local CLI agents (subprocess; pick their own model internally).
  | "claude-code"
  | "opencode"
  | "codex"
  | "gemini-cli";

export interface ModelInfo {
  provider: ProviderId;
  /** Raw id passed to the provider SDK. */
  apiId: string;
  /** NL/EN display name shown in the UI. */
  displayName: string;
  supportsImages: boolean;
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
}

export const MODELS = {
  "claude-opus-4-8": {
    provider: "anthropic",
    apiId: "claude-opus-4-8",
    displayName: "Claude Opus 4.8",
    supportsImages: true,
    tier: 3,
    // Opus is expensive: reachable only as a tool/stage default, never forced by a caller.
    clientSelectable: false,
  },
  "claude-sonnet-4-6": {
    provider: "anthropic",
    apiId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    supportsImages: true,
    tier: 2,
    clientSelectable: true,
  },
  "claude-haiku-4-5": {
    provider: "anthropic",
    apiId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    supportsImages: true,
    tier: 1,
    clientSelectable: true,
  },
  // NB: local OpenAI-compatible models (Ollama / LM Studio) are NOT listed here.
  // They are discovered at runtime from each server's /v1/models endpoint
  // (see discover.server.ts) and resolved via resolveModelInfo().
  //
  // Local CLI agents — run on the user's machine, choose their own model.
  "claude-code": {
    provider: "claude-code",
    apiId: "claude-code",
    displayName: "Claude Code (CLI)",
    supportsImages: false,
    tier: 3,
    local: true,
    // Runs on the caller's own machine; costs the owner nothing.
    clientSelectable: true,
  },
  opencode: {
    provider: "opencode",
    apiId: "opencode",
    displayName: "opencode (CLI)",
    supportsImages: false,
    tier: 2,
    local: true,
    clientSelectable: true,
  },
  codex: {
    provider: "codex",
    apiId: "codex",
    displayName: "Codex (CLI)",
    supportsImages: false,
    tier: 2,
    local: true,
    clientSelectable: true,
  },
  "gemini-cli": {
    provider: "gemini-cli",
    apiId: "gemini-cli",
    displayName: "Gemini CLI",
    supportsImages: false,
    tier: 2,
    local: true,
    clientSelectable: true,
  },
} as const satisfies Record<string, ModelInfo>;

export type ModelId = keyof typeof MODELS;

export const DEFAULT_MODEL: ModelId = "claude-sonnet-4-6";

export function getModel(id: string): ModelInfo {
  const info = (MODELS as Record<string, ModelInfo>)[id];
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
  return (
    (MODELS as Record<string, ModelInfo>)[id] ??
    parseDynamicModel(id) ??
    parseCompatModel(id) ??
    throwUnknown(id)
  );
}

function throwUnknown(id: string): never {
  throw new Error(`Unknown model id: ${id}`);
}

/** Whether an id resolves to a usable model (catalog, dynamic local, or configured compat). */
export function isResolvableModel(id: string): boolean {
  return id in MODELS || parseDynamicModel(id) !== null || parseCompatModel(id) !== null;
}

/**
 * Whether a caller may force this model via the request body. Guards the owner's
 * bill: expensive API models (Opus) are excluded, so a hostile body can only
 * ever downgrade to a selectable model, never up. Unknown ids are not selectable.
 * Phase 4 swaps this body for an admin-configured allow-list.
 */
export function isClientSelectable(id: string): boolean {
  const info =
    (MODELS as Record<string, ModelInfo>)[id] ?? parseDynamicModel(id) ?? parseCompatModel(id);
  return info?.clientSelectable === true;
}

export function listModels(): Array<{ id: ModelId } & ModelInfo> {
  return (Object.entries(MODELS) as Array<[ModelId, ModelInfo]>).map(([id, info]) => ({
    id,
    ...info,
  }));
}

/** Minimal shape needed to render a model <option> (static catalog or discovered local). */
export interface PickerModel {
  id: string;
  displayName: string;
  supportsImages?: boolean;
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
  const base = catalog ?? listModels().filter((m) => m.clientSelectable);
  const all: PickerModel[] = [...base, ...localModels];
  // A vision tool must only offer models KNOWN to support images: an unknown
  // (undefined) flag is treated as non-vision, not waved through.
  return requiresImages ? all.filter((m) => m.supportsImages === true) : all;
}
