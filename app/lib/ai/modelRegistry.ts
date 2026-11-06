/**
 * The admin's model registry: models added from the screen, and the upgrade path of
 * old ones. Pure — the server stores it as one `instance_settings` JSON value and
 * installs it into the catalog (`installModelRegistry` in `models.ts`), so every
 * `resolveModelInfo` call sees added and retiring models without knowing about them.
 *
 * Life of a model: active → retiring (upgraded: new work goes to the successor, a
 * running conversation may finish on the old one) → retired (every call goes to the
 * successor). A model is never deleted: old results keep their model's name.
 */
import { z } from "zod";
import { isResolvableModel, type ModelSettings, type ProviderId } from "./models";
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

export interface ModelRegistry {
  added: AddedModel[];
  /** Only models on their way out are listed; absent = active. */
  lifecycle: Record<string, { state: PhaseOutState; successor: string }>;
}

export const EMPTY_REGISTRY: ModelRegistry = { added: [], lifecycle: {} };

/** A provider's model id: no spaces, no control characters, sane length. */
const API_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/;

const AddedModelSchema = z.object({
  id: z.string().min(1).max(200),
  provider: z.string().refine(isAddableProvider),
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
  const { added, lifecycle } = raw as { added?: unknown; lifecycle?: unknown };
  const out: ModelRegistry = { added: [], lifecycle: {} };
  for (const m of Array.isArray(added) ? added : []) {
    const r = AddedModelSchema.safeParse(m);
    if (r.success) out.added.push(r.data as AddedModel);
  }
  if (lifecycle && typeof lifecycle === "object") {
    for (const [id, entry] of Object.entries(lifecycle)) {
      const r = LifecycleSchema.safeParse(entry);
      if (r.success) out.lifecycle[id] = r.data;
    }
  }
  return out;
}

type Result<E extends string> = { ok: true; registry: ModelRegistry } | { ok: false; error: E };

export type AddModelInput = Omit<AddedModel, "id">;

export function addModel(
  registry: ModelRegistry,
  input: AddModelInput,
):
  | { ok: true; registry: ModelRegistry; id: string }
  | { ok: false; error: "invalid" | "provider" | "duplicate" } {
  if (!isAddableProvider(input.provider)) return { ok: false, error: "provider" };
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
