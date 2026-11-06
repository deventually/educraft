/**
 * Effective availability — the single module every consumer uses to answer "which
 * features/tools/models may THIS user see?" (P28.3, BESLUIT-2026-11-05-5).
 *
 * Three layers, one rule (`~/lib/features/rule.ts`): the instance stand (Off, On,
 * On request), the teams the teacher is in, and the teacher's exception (admin only).
 * An admin has everything the instance has not Off. Boot-invalid tools are never
 * available. Models: the teacher's own set (P18) replaces everything; otherwise the
 * union of their teams' sets, kept within the instance; otherwise the instance.
 *
 * Safe defaults: with empty settings tables a tool reduces to `tool.enabled` and a
 * feature to its register default. Nothing is cached — a write counts on the next request.
 *
 * Context-editor axes (sector/domain) follow the instance settings only.
 */
import { ALL_TOOLS, type Tool } from "~/lib/registry";
import { getInvalidToolSlugs } from "~/lib/registry/boot.server";
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
import { syncModelRegistry } from "./modelRegistry.server";
import { DEFAULT_COUNTRY } from "~/lib/context/countries";
import { SECTORS, type Sector } from "~/lib/context/sectors";
import { getDomainsForTrack } from "~/lib/context/domains";
import { FEATURES, type FeatureId } from "~/lib/features";
import { type Choice, type Decision, type InstanceStand, decide } from "~/lib/features/rule";
import type { TeamSettings } from "~/lib/features/teamSettings";
import { log } from "./log.server";
import {
  getToolStands,
  getFeatureStands,
  getEnabledModels,
  getEnabledSectors,
  getEnabledDomains,
} from "./repositories/settings.server";
import { getUserAssignedModels } from "./repositories/users.server";
import { listTeamSettingsForUser } from "./repositories/teams.server";
import { featureKey, getExceptions, toolKey } from "./repositories/exceptions.server";
import { localModelsEnabled } from "./env.server";

/** The caller: an account id and its role (`teacher` or `admin`). */
export interface AvailabilityUser {
  id: string;
  role: string;
}

export type { Decision };

interface Layers {
  isAdmin: boolean;
  teams: { name: string; settings: TeamSettings }[];
  exceptions: Map<string, Choice>;
}

/** The team and exception layers of one user, read once per request. */
async function resolveLayers(user: AvailabilityUser): Promise<Layers> {
  if (user.role === "admin") return { isAdmin: true, teams: [], exceptions: new Map() };
  const [teams, exceptions] = await Promise.all([
    listTeamSettingsForUser(user.id),
    getExceptions(user.id),
  ]);
  return { isAdmin: false, teams, exceptions };
}

/** The rule for one item, given its instance stand and where to find the team choice. */
function apply(
  layers: Layers,
  instance: InstanceStand,
  teamChoice: (s: TeamSettings) => Choice | undefined,
  key: string,
): Decision {
  if (layers.isAdmin) return { on: instance !== "off", source: "admin" };
  return decide(
    instance,
    layers.teams.map((t) => ({ name: t.name, choice: teamChoice(t.settings) })),
    layers.exceptions.get(key),
  );
}

/** A tool's instance stand: the admin's choice, else the registry (`enabled` = On). */
const toolInstanceStand = (tool: Tool, stands: Map<string, InstanceStand>): InstanceStand =>
  stands.get(tool.slug) ?? (tool.enabled ? "on" : "off");

/** Every tool's effective stand for `user`, with its source (boot-invalid tools: off). */
export async function effectiveTools(user: AvailabilityUser): Promise<Record<string, Decision>> {
  const [stands, layers] = await Promise.all([getToolStands(), resolveLayers(user)]);
  const invalid = getInvalidToolSlugs();
  const out: Record<string, Decision> = {};
  for (const tool of ALL_TOOLS) {
    out[tool.slug] = invalid.has(tool.slug)
      ? { on: false, source: "instance" }
      : apply(
          layers,
          toolInstanceStand(tool, stands),
          (s) => s.tools[tool.slug],
          toolKey(tool.slug),
        );
  }
  return out;
}

/** Every feature's effective stand for `user`, with its source. */
export async function effectiveFeatures(
  user: AvailabilityUser,
): Promise<Record<FeatureId, Decision>> {
  const [stands, layers] = await Promise.all([getFeatureStands(), resolveLayers(user)]);
  return Object.fromEntries(
    FEATURES.map((f) => [
      f.id,
      apply(
        layers,
        stands[f.id] ?? f.defaultStand,
        // A team has no say over an instance-only feature (BESLUIT-2026-11-05-11).
        (s) => (f.instanceOnly ? undefined : s.features[f.id]),
        featureKey(f.id),
      ),
    ]),
  ) as Record<FeatureId, Decision>;
}

/** Whether one feature is on for `user`. */
export async function isFeatureOn(user: AvailabilityUser, id: FeatureId): Promise<boolean> {
  return (await effectiveFeatures(user))[id].on;
}

/** Route gate: a feature that is off for `user` is a 404 (nothing is deleted). */
export async function requireFeature(user: AvailabilityUser, id: FeatureId): Promise<void> {
  if (!(await isFeatureOn(user, id))) throw new Response("Not Found", { status: 404 });
}

/** Every tool `user` may see. */
export async function getAvailableTools(user: AvailabilityUser): Promise<Tool[]> {
  const stands = await effectiveTools(user);
  return ALL_TOOLS.filter((tool) => stands[tool.slug]?.on);
}

/** Single-tool gate — drives the tool.tsx 404 and the api.stream refusal. */
export async function isToolAvailable(user: AvailabilityUser, tool: Tool): Promise<boolean> {
  return (await effectiveTools(user))[tool.slug]?.on ?? false;
}

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
  const own = await userModelSet(user);
  if (own) {
    return new Set(activeCatalogIds().filter((id) => own.has(id)));
  }
  const ids = await selectableCatalogIds();
  if (ids.size === 0) {
    const fallback = currentModelId(DEFAULT_MODEL);
    log("availability_no_selectable_models", { fallback });
    return new Set([fallback]);
  }
  return ids;
}

/**
 * The model to serve when a request doesn't force a selectable one (Phase 14
 * bugfix). `preferred` is the intended fallback (a tool's `defaultModel`), upgraded
 * to its newest version; this returns it only when the caller may actually use it —
 * otherwise it substitutes a model the caller IS allowed, so a disabled/un-granted
 * frontier default can never leak past the teacher gate. Order: the preferred
 * default, then the caller's own set (this is where a local-only teacher's model
 * comes from), then any catalog model, then `DEFAULT_MODEL` as a last resort.
 */
export async function effectiveDefaultModel(
  user: AvailabilityUser,
  preferred: string,
): Promise<string> {
  await syncModelRegistry();
  const wanted = currentModelId(preferred);
  if (await isModelSelectableForUser(user, wanted)) return wanted;
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
  if (!isAllowedHere(id)) return false;
  const effective = currentModelId(id);
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

/**
 * Resolve one availability axis (sector/domain) to the catalogue slugs a user may
 * pick. `selection` is the instance's enabled list; null/empty = no restriction
 * (the whole catalogue). A non-empty selection filters the catalogue; if it
 * filters everything away (a garbage/legacy slug), fall back to the whole
 * catalogue and warn — no editor may offer nothing.
 */
function resolveAxis<T extends string>(
  catalogue: readonly T[],
  selection: Iterable<string> | null,
  lockoutKey: string,
): T[] {
  const set = selection ? new Set(selection) : null;
  if (!set || set.size === 0) return [...catalogue];
  const ids = catalogue.filter((x) => set.has(x));
  if (ids.length === 0) {
    log(lockoutKey, { fallback: "all" });
    return [...catalogue];
  }
  return ids;
}

/** The sectors a teacher/admin may pick in the context editor: the instance set. */
export async function getAvailableSectors(_user: AvailabilityUser): Promise<Sector[]> {
  return resolveAxis(SECTORS, await getEnabledSectors(), "availability_no_available_sectors");
}

/**
 * The flat domain/profiel allow-list that governs a user: the instance's enabled
 * domains (`null` = no restriction). This is the track-independent effective set
 * the editor loader filters each catalogue by; `getAvailableDomains` layers a
 * specific (sector, track) catalogue on top.
 */
export async function getAvailableDomainSlugs(_user: AvailabilityUser): Promise<string[] | null> {
  return getEnabledDomains();
}

/**
 * The domains/profielen a teacher/admin may pick for a given (sector, track): the
 * track-scoped catalogue filtered by the effective domain allow-list
 * (`getAvailableDomainSlugs`). An empty catalogue (mbo/wo, or a vo sector with no
 * track yet) short-circuits to [] — "no catalogue" isn't "everything banned", so
 * no lockout warning. Otherwise the `resolveAxis` lockout guard applies.
 */
export async function getAvailableDomains(
  user: AvailabilityUser,
  sector: string | undefined,
  track: string | undefined,
): Promise<string[]> {
  const catalogue = getDomainsForTrack(DEFAULT_COUNTRY, sector, track).map((d) => d.value);
  if (catalogue.length === 0) return [];
  const selection = await getAvailableDomainSlugs(user);
  return resolveAxis(catalogue, selection, "availability_no_available_domains");
}
