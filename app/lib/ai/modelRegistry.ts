/**
 * The admin's model registry: models added from the screen, and the upgrade path of
 * old ones. Pure — the server stores it as one `instance_settings` JSON value and
 * installs it into the catalog (`installModelRegistry` in `models.ts`), so every
 * `resolveModelInfo` call sees added and retiring models without knowing about them.
 *
 * Life of a model: active → retiring (upgraded: new work goes to the successor, a
 * running conversation may finish on the old one) → retired (every call goes to the
 * successor). A model is never deleted: old results keep their model's name.
 *
 * An admin can also add a provider (an API at an address). Its key still lives on the
 * server: the id and a fresh key setting (`<ID>_API_KEY`) are derived from its name, so
 * a screen-added provider can never be handed the key of another one.
 */
import { z } from "zod";
import {
  isResolvableModel,
  LOCAL_PROVIDERS,
  PROVIDERS,
  type ModelSettings,
  type ProviderId,
} from "./models";
import { isAddableProvider } from "./providers";

export type PhaseOutState = "retiring" | "retired";
export type ModelState = "active" | PhaseOutState;

/** A model the admin added: a provider plus the provider's own model id. */
export interface AddedModel {
  id: string;
  provider: ProviderId;
  apiId: string;
  displayName: string;
  supportsImages: boolean;
  alwaysThinks: boolean;
  clientSelectable: boolean;
  /** Effort and temperature chosen on screen; absent = the provider's default. */
  settings?: ModelSettings;
}

/** A provider the admin added: an API at an address, its key in `.env`. */
export interface AddedProvider {
  id: string;
  name: string;
  api: "anthropic" | "openai-compatible";
  baseURL: string;
  /** Always `<ID>_API_KEY`, derived from the id: never a setting of another provider. */
  keyEnv: string;
  /** An own server that needs no key (an intranet model server). */
  keyOptional?: boolean;
  modelsUrl?: string;
}

export interface ModelRegistry {
  added: AddedModel[];
  /** Only models on their way out are listed; absent = active. */
  lifecycle: Record<string, { state: PhaseOutState; successor: string }>;
  providers: AddedProvider[];
}

export const EMPTY_REGISTRY: ModelRegistry = { added: [], lifecycle: {}, providers: [] };

/** A provider's model id: no spaces, no control characters, sane length. */
const API_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/;

const AddedModelSchema = z.object({
  id: z.string().min(1).max(200),
  provider: z.string().min(1),
  apiId: z.string().regex(API_ID),
  displayName: z.string().trim().min(1).max(80),
  supportsImages: z.boolean(),
  alwaysThinks: z.boolean(),
  clientSelectable: z.boolean(),
  settings: z
    .object({
      temperature: z.number().min(0).max(2).nullable().optional(),
      effort: z.enum(["none", "low", "medium", "high", "xhigh", "max"]).optional(),
    })
    .optional(),
});

const LifecycleSchema = z.object({
  state: z.enum(["retiring", "retired"]),
  successor: z.string().min(1),
});

/** The key setting of an added provider: "eigen-server" → "EIGEN_SERVER_API_KEY". */
export function providerKeyEnv(id: string): string {
  return `${id.toUpperCase().replace(/-/g, "_")}_API_KEY`;
}

/** A provider id from its name: "Groq Cloud EU" → "groq-cloud-eu"; null if no letter leads. */
export function providerIdFromName(name: string): string | null {
  const id = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return /^[a-z][a-z0-9-]*$/.test(id) ? id : null;
}

const PRIVATE_V4 = [/^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^127\./];
const PRIVATE_SUFFIX = [".local", ".internal", ".lan", ".intranet", ".home.arpa"];

/**
 * Whether a host is on the own network: a private IPv4 range, an intranet name
 * (no dot, or a private suffix), or a private IPv6 address. Only those may use http.
 */
export function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return PRIVATE_V4.some((r) => r.test(host));
  if (host.includes(":")) return /^f[cd][0-9a-f]{2}:/.test(host);
  if (!host.includes(".")) return true;
  return PRIVATE_SUFFIX.some((s) => host.endsWith(s));
}

/** https anywhere; plain http only to a host on the own network. */
export function isSafeProviderAddress(address: string): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  return url.protocol === "https:" || (url.protocol === "http:" && isPrivateHost(url.hostname));
}

const HTTPS_OR_INTRANET = z.url().refine(isSafeProviderAddress);

const AddedProviderSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
  name: z.string().trim().min(1).max(60),
  api: z.enum(["anthropic", "openai-compatible"]),
  baseURL: HTTPS_OR_INTRANET,
  keyEnv: z.string(),
  keyOptional: z.boolean().optional(),
  modelsUrl: z
    .url()
    .refine((u) => u.startsWith("https://"))
    .optional(),
});

/** Ids and key settings already taken by the config, the local kinds, and `others`. */
function providerTaken(id: string, keyEnv: string, others: AddedProvider[]): boolean {
  return (
    (LOCAL_PROVIDERS as readonly string[]).includes(id) ||
    PROVIDERS.some((p) => p.id === id || p.keyEnv === keyEnv || p.baseURLEnv === keyEnv) ||
    others.some((p) => p.id === id || p.keyEnv === keyEnv)
  );
}

/** A stored or new provider is valid only with its own derived key and a safe address. */
function validProvider(raw: unknown, others: AddedProvider[]): AddedProvider | null {
  const r = AddedProviderSchema.safeParse(raw);
  if (!r.success || r.data.keyEnv !== providerKeyEnv(r.data.id)) return null;
  if (providerTaken(r.data.id, r.data.keyEnv, others)) return null;
  return r.data as AddedProvider;
}

/** The id of an added model: "<provider>/<apiId>", e.g. "anthropic/claude-haiku-5-5". */
export function customModelId(provider: ProviderId, apiId: string): string {
  return `${provider}/${apiId}`;
}

/** Parse the stored JSON. Anything that does not fit is dropped, never thrown. */
export function parseModelRegistry(json: string | null): ModelRegistry {
  if (!json) return EMPTY_REGISTRY;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return EMPTY_REGISTRY;
  }
  if (!raw || typeof raw !== "object") return EMPTY_REGISTRY;
  const { added, lifecycle, providers } = raw as {
    added?: unknown;
    lifecycle?: unknown;
    providers?: unknown;
  };
  const out: ModelRegistry = { added: [], lifecycle: {}, providers: [] };
  for (const p of Array.isArray(providers) ? providers : []) {
    const valid = validProvider(p, out.providers);
    if (valid) out.providers.push(valid);
  }
  for (const m of Array.isArray(added) ? added : []) {
    const r = AddedModelSchema.safeParse(m);
    if (r.success && knownProvider(out, r.data.provider)) out.added.push(r.data as AddedModel);
  }
  if (lifecycle && typeof lifecycle === "object") {
    for (const [id, entry] of Object.entries(lifecycle)) {
      const r = LifecycleSchema.safeParse(entry);
      if (r.success) out.lifecycle[id] = r.data;
    }
  }
  return out;
}

/** A provider a model may be added on: the config's, or one in this registry. */
function knownProvider(registry: ModelRegistry, id: string): boolean {
  return isAddableProvider(id) || registry.providers.some((p) => p.id === id);
}

export interface AddProviderInput {
  name: string;
  api: AddedProvider["api"];
  baseURL: string;
  modelsUrl?: string;
  /** An own server that needs no key. */
  noKey?: boolean;
}

/** Add a provider. Its id and key setting come from its name; http only on the intranet. */
export function addProvider(
  registry: ModelRegistry,
  input: AddProviderInput,
):
  | { ok: true; registry: ModelRegistry; id: string; keyEnv: string }
  | { ok: false; error: "invalid" | "insecure" | "duplicate" } {
  const id = providerIdFromName(input.name);
  if (!id) return { ok: false, error: "invalid" };
  const keyEnv = providerKeyEnv(id);
  const candidate: AddedProvider = {
    id,
    name: input.name.trim(),
    api: input.api,
    baseURL: input.baseURL.trim(),
    keyEnv,
    ...(input.noKey ? { keyOptional: true } : {}),
    ...(input.modelsUrl?.trim() ? { modelsUrl: input.modelsUrl.trim() } : {}),
  };
  const r = AddedProviderSchema.safeParse(candidate);
  if (!r.success) {
    const urlOk = z.url().safeParse(candidate.baseURL).success;
    const onlyAddress = r.error.issues.every((i) => i.path[0] === "baseURL");
    return { ok: false, error: urlOk && onlyAddress ? "insecure" : "invalid" };
  }
  if (providerTaken(id, keyEnv, registry.providers)) return { ok: false, error: "duplicate" };
  return {
    ok: true,
    id,
    keyEnv,
    registry: { ...registry, providers: [...registry.providers, r.data as AddedProvider] },
  };
}

/** Remove an added provider, only while no added model uses it. */
export function removeProvider(
  registry: ModelRegistry,
  id: string,
): { ok: true; registry: ModelRegistry } | { ok: false; error: "unknown" | "inUse" } {
  if (!registry.providers.some((p) => p.id === id)) return { ok: false, error: "unknown" };
  if (registry.added.some((m) => m.provider === id)) return { ok: false, error: "inUse" };
  return {
    ok: true,
    registry: { ...registry, providers: registry.providers.filter((p) => p.id !== id) },
  };
}

type Result<E extends string> = { ok: true; registry: ModelRegistry } | { ok: false; error: E };

export type AddModelInput = Omit<AddedModel, "id">;

export function addModel(
  registry: ModelRegistry,
  input: AddModelInput,
):
  | { ok: true; registry: ModelRegistry; id: string }
  | { ok: false; error: "invalid" | "provider" | "duplicate" } {
  if (!knownProvider(registry, input.provider)) return { ok: false, error: "provider" };
  const id = customModelId(input.provider, input.apiId.trim());
  const parsed = AddedModelSchema.safeParse({ ...input, id, apiId: input.apiId.trim() });
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (registry.added.some((m) => m.id === id) || isResolvableModel(id)) {
    return { ok: false, error: "duplicate" };
  }
  return {
    ok: true,
    id,
    registry: { ...registry, added: [...registry.added, parsed.data as AddedModel] },
  };
}

function stateIn(registry: ModelRegistry, id: string): ModelState {
  return registry.lifecycle[id]?.state ?? "active";
}

/**
 * Upgrade `from` to `to`: `from` starts retiring. `known` says which ids exist; by
 * default the installed catalog plus this registry's added models.
 */
export function startUpgrade(
  registry: ModelRegistry,
  from: string,
  to: string,
  known: (id: string) => boolean = (id) =>
    isResolvableModel(id) || registry.added.some((m) => m.id === id),
): Result<"self" | "unknown" | "alreadyRetiring" | "successorRetiring"> {
  if (from === to) return { ok: false, error: "self" };
  if (!known(from) || !known(to)) return { ok: false, error: "unknown" };
  if (stateIn(registry, from) !== "active") return { ok: false, error: "alreadyRetiring" };
  if (stateIn(registry, to) !== "active") return { ok: false, error: "successorRetiring" };
  return {
    ok: true,
    registry: {
      ...registry,
      lifecycle: { ...registry.lifecycle, [from]: { state: "retiring", successor: to } },
    },
  };
}

/** Second step: the old model is retired, every call goes to its successor. */
export function finishUpgrade(registry: ModelRegistry, id: string): Result<"notRetiring"> {
  const entry = registry.lifecycle[id];
  if (entry?.state !== "retiring") return { ok: false, error: "notRetiring" };
  return {
    ok: true,
    registry: {
      ...registry,
      lifecycle: { ...registry.lifecycle, [id]: { ...entry, state: "retired" } },
    },
  };
}

/** Undo either step: the model is active again. */
export function cancelUpgrade(registry: ModelRegistry, id: string): Result<"notRetiring"> {
  if (!registry.lifecycle[id]) return { ok: false, error: "notRetiring" };
  const { [id]: _gone, ...rest } = registry.lifecycle;
  return { ok: true, registry: { ...registry, lifecycle: rest } };
}
