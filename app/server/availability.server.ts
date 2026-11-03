/**
 * Effective availability — the single module every consumer uses to answer "which
 * tools/models may THIS user see?". One gate sits on top of the registry's
 * boot-validity check: instance availability, an admin's `tool_settings`
 * (enabled). There is no per-teacher tool gate (P18): every teacher and admin
 * sees what the instance enables.
 *
 * Safe defaults: with empty settings tables this reduces exactly to `tool.enabled`,
 * so a fresh instance shows every tool to every teacher and admin.
 * Nothing is cached — a write takes effect on the next request (no bust needed).
 *
 * Context-editor axes (sector/domain) follow the instance settings too
 * (`enabledSectors`/`enabledDomains`); there is no per-teacher access (P18) and no
 * country axis (the country is a data seam in the packs, not a choice).
 */
import { ALL_TOOLS, type Tool } from "~/lib/registry";
import { getInvalidToolSlugs } from "~/lib/registry/boot.server";
import type { Role } from "~/lib/registry/access";
import {
  DEFAULT_MODEL,
  isResolvableModel,
  listModels,
  resolveModelInfo,
  type PickerModel,
} from "~/lib/ai/models";
import { DEFAULT_COUNTRY } from "~/lib/context/countries";
import { SECTORS, type Sector } from "~/lib/context/sectors";
import { getDomainsForTrack } from "~/lib/context/domains";
import { log } from "./log.server";
import {
  getToolSettings,
  getEnabledModels,
  getEnabledSectors,
  getEnabledDomains,
} from "./repositories/settings.server";
import { getUserAssignedModels } from "./repositories/users.server";

export interface AvailabilityUser {
  id: string;
  role: Role;
}

interface AvailabilityContext {
  settings: Map<string, { enabled: boolean | null }>;
}

/** Resolve every gate input once per request, so a list filter is a pure map. */
async function resolveContext(): Promise<AvailabilityContext> {
  const rows = await getToolSettings();
  const settings = new Map(rows.map((r) => [r.toolSlug, { enabled: r.enabled }]));
  return { settings };
}

/** Whether a tool passes the boot-validity check and the instance gate, given a resolved context. */
function passes(tool: Tool, ctx: AvailabilityContext): boolean {
  // Boot-invalid tools (Phase 5.5) are excluded from every listing and refused by
  // the stream, in production, rather than crashing the instance.
  if (getInvalidToolSlugs().has(tool.slug)) return false;

  const setting = ctx.settings.get(tool.slug);
  const enabled = setting?.enabled ?? tool.enabled;
  return enabled;
}

/**
 * Every tool `user` may see: the instance gate. `user` is kept in the signature so
 * every caller stays unchanged (and a future gate has the seam).
 */
export async function getAvailableTools(_user: AvailabilityUser): Promise<Tool[]> {
  const ctx = await resolveContext();
  return ALL_TOOLS.filter((tool) => passes(tool, ctx));
}

/** Single-tool gate — drives the tool.tsx 404 and the api.stream refusal. */
export async function isToolAvailable(_user: AvailabilityUser, tool: Tool): Promise<boolean> {
  const ctx = await resolveContext();
  return passes(tool, ctx);
}

/**
 * The instance base for the model gates: client-selectable catalog ∩ the admin's
 * `enabledModels` allow-list (Opus-class stays server-only). No lockout fallback
 * here — that is applied once, after the per-teacher narrowing below.
 */
async function selectableCatalogIds(): Promise<Set<string>> {
  const enabled = await getEnabledModels();
  const catalog = listModels()
    .filter((m) => m.clientSelectable)
    .map((m) => m.id);
  return new Set(catalog.filter((id) => enabled === null || enabled.includes(id)));
}

/** Narrow a model set by a restriction (INTERSECT). null/empty = no change. */
function narrowModels(ids: Set<string>, restriction: Set<string> | null): Set<string> {
  if (!restriction || restriction.size === 0) return ids;
  return new Set([...ids].filter((id) => restriction.has(id)));
}

/**
 * The catalog model ids a caller may select. Composes two INTERSECT gates
 * (Phase 13), each only ever *narrowing* — the opposite of the P12 context axes:
 *   1. Instance base — the admin's `enabledModels` (client-selectable only).
 *   2. Per-teacher — an admin's `assignedModels` for a teacher (⊆ base).
 * Empty/unset at a level = inherit the level above; admin/no-user = the base.
 * Local/discovered models are free and always allowed, so they are added by the
 * caller via `pickableModels`, not here. Lockout guard: an empty final set (only
 * reachable via a stale allow-list) falls back to the catalog default and warns —
 * no configuration may lock a user out of generation entirely.
 */
export async function getSelectableModelIds(user?: AvailabilityUser): Promise<Set<string>> {
  const base = await selectableCatalogIds();
  const restriction = await userModelRestriction(user);
  const ids = narrowModels(base, restriction);
  if (ids.size === 0 && !restrictionGrantsUsableModel(restriction)) {
    // A genuine lockout: the intersection is empty AND the caller's restriction
    // grants no usable model at all (unset, or only stale/unknown catalog ids).
    // Rescue with the default so no configuration locks a user out of generation.
    // NOT a lockout — and so NOT rescued — is a restriction that lists a
    // resolvable local/CLI model (e.g. a teacher assigned only "ollama::…"): that
    // model rides `narrowLocalModels`/`isModelSelectableForUser`, so the catalog
    // half is legitimately empty. Injecting DEFAULT_MODEL there would re-offer a
    // frontier default the teacher/admin explicitly excluded (the P14 bug).
    log("availability_no_selectable_models", { fallback: DEFAULT_MODEL });
    return new Set([DEFAULT_MODEL]);
  }
  return ids;
}

/** The per-teacher model restriction for a caller (null = no restriction). */
async function userModelRestriction(user?: AvailabilityUser): Promise<Set<string> | null> {
  return user?.role === "teacher" ? getUserAssignedModels(user.id) : null;
}

/** Whether a restriction lists at least one resolvable, client-selectable model. */
function restrictionGrantsUsableModel(restriction: Set<string> | null): boolean {
  if (!restriction || restriction.size === 0) return false;
  return [...restriction].some(
    (id) => isResolvableModel(id) && resolveModelInfo(id).clientSelectable,
  );
}

/**
 * The model to serve when a request doesn't force a selectable one (Phase 14
 * bugfix). `preferred` is the intended fallback (a tool's `defaultModel`); this
 * returns it only when the caller may actually use it — otherwise it substitutes
 * a model the caller IS allowed, so a disabled/un-granted frontier default can
 * never leak past the teacher gate. Order: the preferred default, then the
 * caller's own allow-list (this is where a local-only teacher's model comes from),
 * then any catalog model, then `DEFAULT_MODEL` as a last resort.
 */
export async function effectiveDefaultModel(
  user: AvailabilityUser,
  preferred: string,
): Promise<string> {
  if (await isModelSelectableForUser(user, preferred)) return preferred;
  const restriction = await userModelRestriction(user);
  if (restriction) {
    for (const id of restriction) {
      if (await isModelSelectableForUser(user, id)) return id;
    }
  }
  for (const id of await getSelectableModelIds(user)) return id;
  return DEFAULT_MODEL;
}

/**
 * The catalog picker models a caller may choose — `getSelectableModelIds` mapped
 * to picker shape. Pass the caller so the picker reflects their effective set
 * (instance base narrowed by the teacher gate); omit for the raw base.
 */
export async function getSelectableModels(user?: AvailabilityUser): Promise<PickerModel[]> {
  const ids = await getSelectableModelIds(user);
  return listModels()
    .filter((m) => ids.has(m.id))
    .map((m) => ({ id: m.id, displayName: m.displayName, supportsImages: m.supportsImages }));
}

/**
 * Whether a *single* model id is selectable for `user` (Phase 14) — the gate that
 * governs local/CLI/discovered models too. Unlike `getSelectableModelIds`, which
 * enumerates the static catalog, this is a membership walk so it works for volatile
 * discovered ids (`ollama::…`) without enumerating any local server: the id must be
 * resolvable and client-selectable (Opus-class stays out), then each applicable
 * INTERSECT level must either impose no restriction (null/empty ⇒ inherit) or list
 * the id — instance `enabledModels`, then the teacher's assignment. Empty at every level = every resolvable, client-selectable model is
 * allowed (an uncurated instance is unchanged: local/CLI stay free but curatable).
 */
export async function isModelSelectableForUser(
  user: AvailabilityUser | undefined,
  id: string,
): Promise<boolean> {
  if (!isResolvableModel(id) || !resolveModelInfo(id).clientSelectable) return false;
  const enabled = await getEnabledModels();
  if (enabled !== null && enabled.length > 0 && !enabled.includes(id)) return false;
  const restriction = await userModelRestriction(user);
  if (restriction && restriction.size > 0 && !restriction.has(id)) return false;
  return true;
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
