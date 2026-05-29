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
}

export const MODELS = {
  "claude-opus-4-8": {
    provider: "anthropic",
    apiId: "claude-opus-4-8",
    displayName: "Claude Opus 4.8",
    supportsImages: true,
    tier: 3,
  },
  "claude-sonnet-4-6": {
    provider: "anthropic",
    apiId: "claude-sonnet-4-6",
    displayName: "Claude Sonnet 4.6",
    supportsImages: true,
    tier: 2,
  },
  "claude-haiku-4-5": {
    provider: "anthropic",
    apiId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
    supportsImages: true,
    tier: 1,
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
  },
  opencode: {
    provider: "opencode",
    apiId: "opencode",
    displayName: "opencode (CLI)",
    supportsImages: false,
    tier: 2,
    local: true,
  },
  codex: {
    provider: "codex",
    apiId: "codex",
    displayName: "Codex (CLI)",
    supportsImages: false,
    tier: 2,
    local: true,
  },
  "gemini-cli": {
    provider: "gemini-cli",
    apiId: "gemini-cli",
    displayName: "Gemini CLI",
    supportsImages: false,
    tier: 2,
    local: true,
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
  return { provider, apiId, displayName: apiId, supportsImages: false, tier: 2, local: true };
}

/**
 * Resolve a model id to its ModelInfo: the static catalog first, then a
 * dynamically-discovered local id ("<provider>::<apiId>"). Throws if neither.
 */
export function resolveModelInfo(id: string): ModelInfo {
  return (MODELS as Record<string, ModelInfo>)[id] ?? parseDynamicModel(id) ?? throwUnknown(id);
}

function throwUnknown(id: string): never {
  throw new Error(`Unknown model id: ${id}`);
}

/** Whether an id resolves to a usable model (static catalog or dynamic local). */
export function isResolvableModel(id: string): boolean {
  return id in MODELS || parseDynamicModel(id) !== null;
}

export function listModels(): Array<{ id: ModelId } & ModelInfo> {
  return (Object.entries(MODELS) as Array<[ModelId, ModelInfo]>).map(([id, info]) => ({
    id,
    ...info,
  }));
}
