/**
 * Effective availability for models (P18, P28.3): which models THIS user may select and
 * which one serves a request. The teacher's own set replaces everything; otherwise the
 * union of their teams' sets, kept within the instance; otherwise the instance's
 * allow-list. Callers import it through `availability.server`.
 */
import {
  currentModelId,
  DEFAULT_MODEL,
  forwardRetired,
  isResolvableModel,
  listModels,
  modelState,
  resolveModelInfo,
  type PickerModel,
} from "~/lib/ai/models";
import type { AvailabilityUser } from "./availability.server";
import { localModelsEnabled } from "./env.server";
import { log } from "./log.server";
import { isGrantable } from "./modelCatalog.server";
import { syncModelRegistry } from "./modelRegistry.server";
import { getDefaultModel, getEnabledModels } from "./repositories/settings.server";
import { listTeamSettingsForUser } from "./repositories/teams.server";
import {
  getUserAssignedModels,
  getUserDefaultModel,
  getUserExtraModels,
} from "./repositories/users.server";

/**
 * Whether a model id may exist for this process at all: resolvable, client-selectable
 * (Opus-class stays server-only), not retired, and — for CLI agents and local models —
 * only outside production (`localModelsEnabled`). A retiring model is still allowed:
 * a running conversation may finish on it.
 */
function isAllowedHere(id: string): boolean {
  if (!isResolvableModel(id) || modelState(id) === "retired") return false;
  const info = resolveModelInfo(id);
  return info.clientSelectable && (!info.local || localModelsEnabled());
}

/**
 * A stored set (allow-list, own set, team set) as it counts today: each id that was
 * upgraded stands for its newest version, so "Haiku 4.5" in a set offers "Haiku 5.5".
 */
function upgraded(ids: Iterable<string>): Set<string> {
  return new Set([...ids].map(currentModelId));
}

/** The admin's allow-list, upgraded; null = no list (every model). */
async function enabledSet(): Promise<Set<string> | null> {
  const enabled = await getEnabledModels();
  return enabled === null || enabled.length === 0 ? null : upgraded(enabled);
}

/** Catalog models for new work: allowed here and active (not on their way out). */
function activeCatalogIds(): string[] {
  return listModels()
    .filter((m) => modelState(m.id) === "active" && isAllowedHere(m.id))
    .map((m) => m.id);
}

/**
 * The instance base for the model gates: the active catalog models ∩ the admin's
 * `enabledModels` allow-list (null = the whole catalog). No lockout fallback here — that
 * is applied once, in `getSelectableModelIds`.
 */
async function selectableCatalogIds(): Promise<Set<string>> {
  const enabled = await enabledSet();
  return new Set(activeCatalogIds().filter((id) => enabled === null || enabled.has(id)));
}

/**
 * A teacher's own model set (P18), or null when they follow the instance. The stored
 * ids are upgraded and filtered with `isAllowedHere`; a set that is empty after
 * filtering (only unknown ids, or only CLI/local ids in production) counts as "not
 * set". An admin has no own set.
 */
async function teacherOwnSet(user?: AvailabilityUser): Promise<Set<string> | null> {
  if (user?.role !== "teacher") return null;
  const assigned = await getUserAssignedModels(user.id);
  if (!assigned) return null;
  const own = new Set([...upgraded(assigned)].filter(isAllowedHere));
  return own.size > 0 ? own : null;
}

/**
 * The team layer for models (P28.3): the union of the sets of the teacher's teams, kept
 * within the instance (allowed here and in `enabledModels`). Null when no team has a set,
 * or when nothing of it is left inside the instance (then the instance counts).
 */
async function teamModelSet(user?: AvailabilityUser): Promise<Set<string> | null> {
  if (user?.role !== "teacher") return null;
  const teams = await listTeamSettingsForUser(user.id);
  const union = upgraded(teams.flatMap((t) => t.settings.models ?? []));
  if (union.size === 0) return null;
  const enabled = await enabledSet();
  const inside = [...union].filter(
    (id) => isAllowedHere(id) && (enabled === null || enabled.has(id)),
  );
  return inside.length > 0 ? new Set(inside) : null;
}

/**
 * The expensive models switched on for `user`: their own and their teams', upgraded, only
 * grantable ones. Teachers only; an admin's own requests stay on the instance set.
 */
async function grantedSet(user?: AvailabilityUser): Promise<Set<string>> {
  if (user?.role !== "teacher") return new Set();
  const own = (await getUserExtraModels(user.id)) ?? [];
  const teams = (await listTeamSettingsForUser(user.id)).flatMap(
    (t) => t.settings.extraModels ?? [],
  );
  return new Set([...upgraded([...own, ...teams])].filter(isGrantable));
}

/** The set that decides for `user`: own set, else the team union, else null (the instance). */
async function userModelSet(user?: AvailabilityUser): Promise<Set<string> | null> {
  await syncModelRegistry();
  return (await teacherOwnSet(user)) ?? (await teamModelSet(user));
}

/**
 * The catalog model ids a caller may select. Instance base = the admin's `enabledModels`;
 * a teacher's team sets narrow it (P28.3); a teacher with an own set (`assignedModels`) gets exactly that set instead — it
 * OVERRIDES the instance and may be wider (P18). No own set = follow the instance;
 * an admin always gets the instance set. Local/discovered models are added by the
 * caller via `narrowLocalModels`, not here. A model being upgraded is never offered:
 * its newest version stands in for it. Lockout guard: an empty instance set (a
 * stale allow-list) falls back to the catalog default and warns. An own set holding
 * only a local model leaves the catalog half legitimately empty — no fallback, or the
 * disabled frontier default would be re-offered (the P14 bug).
 */
export async function getSelectableModelIds(user?: AvailabilityUser): Promise<Set<string>> {
  // Expensive models switched on for this person come on top (BESLUIT-2026-11-18-5).
  const granted = [...(await grantedSet(user))].filter((id) => modelState(id) === "active");
  const own = await userModelSet(user);
  if (own) {
    return new Set([...activeCatalogIds().filter((id) => own.has(id)), ...granted]);
  }
  const ids = new Set([...(await selectableCatalogIds()), ...granted]);
  if (ids.size === 0) {
    const fallback = currentModelId(DEFAULT_MODEL);
    log("availability_no_selectable_models", { fallback });
    return new Set([fallback]);
  }
  return ids;
}

/**
 * The chosen defaults that apply to `user`, most personal first: their own, then their
 * teams' (by team name; teachers only, as the team layer for models), then the
 * institution's. Each is only a wish: `effectiveDefaultModel` takes the first one the
 * caller may actually use.
 */
async function chosenDefaults(user: AvailabilityUser): Promise<string[]> {
  const own = await getUserDefaultModel(user.id);
  const team =
    user.role === "teacher"
      ? (await listTeamSettingsForUser(user.id)).flatMap((t) =>
          t.settings.defaultModel ? [t.settings.defaultModel] : [],
        )
      : [];
  const institution = await getDefaultModel();
  return [...(own ? [own] : []), ...team, ...(institution ? [institution] : [])];
}

/**
 * The model to serve when a request doesn't force a selectable one (Phase 14
 * bugfix). `preferred` is the intended fallback (a tool's `defaultModel`), upgraded
 * to its newest version; this returns it only when the caller may actually use it —
 * otherwise it substitutes a model the caller IS allowed, so a disabled/un-granted
 * frontier default can never leak past the teacher gate. Order: the chosen defaults
 * (own, team, institution: `chosenDefaults`), then the preferred default, then the
 * caller's own set (this is where a local-only teacher's model comes from), then any
 * catalog model, then `DEFAULT_MODEL` as a last resort.
 */
export async function effectiveDefaultModel(
  user: AvailabilityUser,
  preferred: string,
): Promise<string> {
  await syncModelRegistry();
  for (const id of [...(await chosenDefaults(user)), preferred]) {
    const wanted = currentModelId(id);
    if (await isModelSelectableForUser(user, wanted)) return wanted;
  }
  const own = await userModelSet(user);
  if (own) {
    for (const id of own) {
      if (await isModelSelectableForUser(user, id)) return id;
    }
  }
  for (const id of await getSelectableModelIds(user)) return id;
  return currentModelId(DEFAULT_MODEL);
}

/**
 * A tool as a page hands it to its picker: starting on this person's default model
 * (`effectiveDefaultModel`) instead of the registry's.
 */
export async function withDefaultModelFor<T extends { defaultModel: string }>(
  user: AvailabilityUser,
  tool: T,
): Promise<T> {
  return { ...tool, defaultModel: await effectiveDefaultModel(user, tool.defaultModel) };
}

/**
 * The model a stream request is served with. A requested model is honoured when the
 * caller may select it — a retired one hands over to its successor first. Otherwise a
 * stage's pinned model (infra, respected as-is, but upgraded), else the tool default
 * resolved for this caller (`effectiveDefaultModel`).
 */
export async function servedModelFor(
  user: AvailabilityUser,
  requested: string | undefined,
  toolDefault: string,
  stagePin?: string,
): Promise<string> {
  await syncModelRegistry();
  const asked = requested ? forwardRetired(requested) : undefined;
  if (asked && (await isModelSelectableForUser(user, asked))) return asked;
  if (stagePin) return currentModelId(stagePin);
  return effectiveDefaultModel(user, toolDefault);
}

/**
 * The catalog picker models a caller may choose — `getSelectableModelIds` mapped
 * to picker shape. Pass the caller so the picker reflects their effective set
 * (their own set, else the instance set); omit for the raw instance base.
 */
export async function getSelectableModels(user?: AvailabilityUser): Promise<PickerModel[]> {
  const ids = await getSelectableModelIds(user);
  return listModels()
    .filter((m) => ids.has(m.id))
    .map((m) => ({ id: m.id, displayName: m.displayName, supportsImages: m.supportsImages }));
}

/**
 * Whether a *single* model id is selectable for `user` — the gate that governs
 * local/CLI/discovered models too. Unlike `getSelectableModelIds`, which enumerates
 * the static catalog, this is a membership walk so it works for volatile discovered
 * ids (`ollama::…`) without enumerating any local server. The id must be allowed here
 * (resolvable, client-selectable, not retired, CLI/local only outside production); a
 * retiring id counts when its newest version does (a running conversation finishes
 * on it). Then a teacher with an own set is decided by it alone (override), everyone
 * else by the instance's `enabledModels` (null/empty = all).
 */
export async function isModelSelectableForUser(
  user: AvailabilityUser | undefined,
  id: string,
): Promise<boolean> {
  await syncModelRegistry();
  const effective = currentModelId(id);
  // An expensive model counts only where the admin switched it on (BESLUIT-2026-11-18-5).
  if (isGrantable(id)) return isGrantable(effective) && (await grantedSet(user)).has(effective);
  if (!isAllowedHere(id)) return false;
  if (effective !== id && !isAllowedHere(effective)) return false;
  const own = await userModelSet(user);
  if (own) return own.has(effective);
  const enabled = await enabledSet();
  return enabled === null || enabled.has(effective);
}

/**
 * Filter a list of discovered local/compat picker models to the ones `user` may
 * select (Phase 14). The static catalog half of the picker comes from
 * `getSelectableModels`; this is the discovered half — dropped entries never reach
 * the client, so a disabled/un-granted local model is not offered.
 */
export async function narrowLocalModels(
  user: AvailabilityUser | undefined,
  discovered: PickerModel[],
): Promise<PickerModel[]> {
  const out: PickerModel[] = [];
  for (const model of discovered) {
    if (await isModelSelectableForUser(user, model.id)) out.push(model);
  }
  return out;
}
