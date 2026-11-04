/**
 * Effective availability — the single module every consumer uses to answer "which
 * tools/models may THIS user see?". One gate sits on top of the registry's
 * boot-validity check: instance availability, an admin's `tool_settings`
 * (enabled). There is no per-teacher tool gate (P18): every teacher and admin
 * sees what the instance enables. Models: the instance `enabledModels`, which a
 * teacher's own set (`assignedModels`) replaces (P18); CLI/local models exist only
 * outside production.
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
import { localModelsEnabled } from "./env.server";

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
 * Whether a model id may exist for this process at all: resolvable, client-selectable
 * (Opus-class stays server-only) and — for CLI agents and local models — only outside
 * production (`localModelsEnabled`).
 */
function isAllowedHere(id: string): boolean {
  if (!isResolvableModel(id)) return false;
  const info = resolveModelInfo(id);
  return info.clientSelectable && (!info.local || localModelsEnabled());
}

/**
 * The instance base for the model gates: the catalog models allowed here ∩ the admin's
 * `enabledModels` allow-list (null = the whole catalog). No lockout fallback here — that
 * is applied once, in `getSelectableModelIds`.
 */
async function selectableCatalogIds(): Promise<Set<string>> {
  const enabled = await getEnabledModels();
  const catalog = listModels()
    .filter((m) => isAllowedHere(m.id))
    .map((m) => m.id);
  return new Set(catalog.filter((id) => enabled === null || enabled.includes(id)));
}

/**
 * A teacher's own model set (P18), or null when they follow the instance. The stored
 * ids are filtered with `isAllowedHere`; a set that is empty after filtering (only
 * unknown ids, or only CLI/local ids in production) counts as "not set". An admin has
 * no own set.
 */
async function teacherOwnSet(user?: AvailabilityUser): Promise<Set<string> | null> {
  if (user?.role !== "teacher") return null;
  const assigned = await getUserAssignedModels(user.id);
  if (!assigned) return null;
  const own = new Set([...assigned].filter(isAllowedHere));
  return own.size > 0 ? own : null;
}

/**
 * The catalog model ids a caller may select. Instance base = the admin's `enabledModels`;
 * a teacher with an own set (`assignedModels`) gets exactly that set instead — it
 * OVERRIDES the instance and may be wider (P18). No own set = follow the instance;
 * an admin always gets the instance set. Local/discovered models are added by the
 * caller via `narrowLocalModels`, not here. Lockout guard: an empty instance set (a
 * stale allow-list) falls back to the catalog default and warns. An own set holding
 * only a local model leaves the catalog half legitimately empty — no fallback, or the
 * disabled frontier default would be re-offered (the P14 bug).
 */
export async function getSelectableModelIds(user?: AvailabilityUser): Promise<Set<string>> {
  const own = await teacherOwnSet(user);
  if (own) {
    return new Set(
      listModels()
        .filter((m) => own.has(m.id))
        .map((m) => m.id),
    );
  }
  const ids = await selectableCatalogIds();
  if (ids.size === 0) {
    log("availability_no_selectable_models", { fallback: DEFAULT_MODEL });
    return new Set([DEFAULT_MODEL]);
  }
  return ids;
}

/**
 * The model to serve when a request doesn't force a selectable one (Phase 14
 * bugfix). `preferred` is the intended fallback (a tool's `defaultModel`); this
 * returns it only when the caller may actually use it — otherwise it substitutes
 * a model the caller IS allowed, so a disabled/un-granted frontier default can
 * never leak past the teacher gate. Order: the preferred default, then the
 * caller's own set (this is where a local-only teacher's model comes from),
 * then any catalog model, then `DEFAULT_MODEL` as a last resort.
 */
export async function effectiveDefaultModel(
  user: AvailabilityUser,
  preferred: string,
): Promise<string> {
  if (await isModelSelectableForUser(user, preferred)) return preferred;
  const own = await teacherOwnSet(user);
  if (own) {
    for (const id of own) {
      if (await isModelSelectableForUser(user, id)) return id;
    }
  }
  for (const id of await getSelectableModelIds(user)) return id;
  return DEFAULT_MODEL;
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
 * (resolvable, client-selectable, CLI/local only outside production); then a teacher
 * with an own set is decided by it alone (override), everyone else by the instance's
 * `enabledModels` (null/empty = all).
 */
export async function isModelSelectableForUser(
  user: AvailabilityUser | undefined,
  id: string,
): Promise<boolean> {
  if (!isAllowedHere(id)) return false;
  const own = await teacherOwnSet(user);
  if (own) return own.has(id);
  const enabled = await getEnabledModels();
  return enabled === null || enabled.length === 0 || enabled.includes(id);
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
