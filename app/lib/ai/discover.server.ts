import { dynamicModelId, type ModelInfo, type ModelId } from "./models";
import { env } from "~/server/env.server";

/** A discovered model carries the same shape as the catalog plus its runtime id. */
export type DiscoveredModel = { id: string } & ModelInfo;

interface LocalServer {
  provider: "ollama" | "lmstudio";
  baseURL: string;
  label: string;
}

const LOCAL_SERVERS: LocalServer[] = [
  { provider: "ollama", baseURL: env.OLLAMA_BASE_URL, label: "Ollama" },
  { provider: "lmstudio", baseURL: env.LMSTUDIO_BASE_URL, label: "LM Studio" },
];

/** Shape of the OpenAI-compatible /v1/models response. */
interface ModelsResponse {
  data?: Array<{ id?: unknown }>;
}

/** Query one server's /v1/models, failing soft (server down/absent → []). */
async function discoverServer(server: LocalServer, timeoutMs: number): Promise<DiscoveredModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${server.baseURL.replace(/\/$/, "")}/models`, {
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as ModelsResponse;
    const ids = (body.data ?? [])
      .map((m) => (typeof m.id === "string" ? m.id : null))
      .filter((id): id is string => !!id);
    return ids.map((apiId) => ({
      id: dynamicModelId(server.provider, apiId),
      provider: server.provider,
      apiId,
      displayName: `${server.label} · ${apiId}`,
      supportsImages: false,
      tier: 2,
      local: true,
    }));
  } catch {
    // Server not running / not installed / timed out — simply contribute nothing.
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Discover all locally-served OpenAI-compatible models (Ollama, LM Studio) by
 * querying each server's /v1/models. Servers that are down or absent contribute
 * nothing, so this is always safe to call. Used to augment the static catalog in
 * the model picker.
 */
export async function discoverLocalModels(timeoutMs = 1500): Promise<DiscoveredModel[]> {
  const results = await Promise.all(LOCAL_SERVERS.map((s) => discoverServer(s, timeoutMs)));
  return results.flat();
}

/** True if `id` is a known static catalog id or matches a discovered local model. */
export function isKnownModel(id: string, discovered: DiscoveredModel[]): id is ModelId | string {
  return discovered.some((m) => m.id === id);
}
