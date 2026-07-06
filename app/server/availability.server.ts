/**
 * Effective availability (Phase 4) — the single module every consumer uses to
 * answer "which tools/models may THIS user see?". It composes three independent
 * gates on top of the registry:
 *
 *   1. Instance availability — an admin's `tool_settings` (enabled + audience).
 *   2. Role/cohort — the Phase 1/6 `canUseTool` logic (student cohort allow-list).
 *   3. Per-teacher allow-list — an admin may narrow an individual teacher's tools.
 *
 * Safe defaults: with empty settings tables this reduces exactly to the previous
 * behaviour (`tool.enabled` + `tool.userType`), so a fresh instance is unchanged.
 * Nothing is cached — a write takes effect on the next request (no bust needed).
 *
 * Context-editor axes (country/sector/domain) use a different, OVERRIDE model
 * (Phase 12), NOT the intersect the tool gates use: a teacher either inherits the
 * instance or, once given *custom access*, replaces it entirely with their own
 * selection (empty axis = all). See `axisSelection`/`resolveAxis` below.
 */
import { ALL_TOOLS, type Tool } from "~/lib/registry";
import { getInvalidToolSlugs } from "~/lib/registry/boot.server";
import { canUseTool, type Audience, type Role } from "~/lib/registry/access";
import { DEFAULT_MODEL, listModels, type PickerModel } from "~/lib/ai/models";
import { COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from "~/lib/context/countries";
import { SECTORS, type Sector } from "~/lib/context/sectors";
import { getDomainsForTrack } from "~/lib/context/domains";
import { log } from "./log.server";
import {
  getToolSettings,
  getEnabledModels,
  getEnabledCountries,
  getEnabledSectors,
  getEnabledDomains,
} from "./repositories/settings.server";
import {
  getUserToolAllowlist,
  getUserAssignedCountries,
  getUserAssignedSectors,
  getUserAssignedDomains,
  getUserContextCustomAccess,
} from "./repositories/users.server";
import { getAllowedToolSlugs } from "./repositories/cohorts.server";

export interface AvailabilityUser {
  id: string;
  role: Role;
}

interface AvailabilityContext {
  settings: Map<string, { enabled: boolean | null; audienceOverride: string | null }>;
  teacherAllowlist: Set<string> | null; // teachers only
  studentAllowlist: Set<string> | null; // students only (cohort)
}

/** Resolve every gate input once per request, so a list filter is a pure map. */
async function resolveContext(user: AvailabilityUser): Promise<AvailabilityContext> {
  const rows = await getToolSettings();
  const settings = new Map(
    rows.map((r) => [r.toolSlug, { enabled: r.enabled, audienceOverride: r.audienceOverride }]),
  );
  const teacherAllowlist = user.role === "teacher" ? await getUserToolAllowlist(user.id) : null;
  const studentAllowlist = user.role === "student" ? await getAllowedToolSlugs(user.id) : null;
  return { settings, teacherAllowlist, studentAllowlist };
}

/** Whether a tool passes all three gates for `user`, given a resolved context. */
function passes(user: AvailabilityUser, tool: Tool, ctx: AvailabilityContext): boolean {
  // Boot-invalid tools (Phase 5.5) are excluded from every listing and refused by
  // the stream, in production, rather than crashing the instance.
  if (getInvalidToolSlugs().has(tool.slug)) return false;

  const setting = ctx.settings.get(tool.slug);
  const enabled = setting?.enabled ?? tool.enabled;
  if (!enabled) return false;

  const audience = (setting?.audienceOverride ?? tool.userType) as Audience;
  if (!canUseTool(user, { slug: tool.slug, userType: audience }, ctx.studentAllowlist)) {
    return false;
  }

  // A teacher may be narrowed to a subset of tools by the admin who invited them.
  if (user.role === "teacher" && ctx.teacherAllowlist && !ctx.teacherAllowlist.has(tool.slug)) {
    return false;
  }
  return true;
}

/** Every tool `user` may see, honoring instance + role/cohort + teacher gates. */
export async function getAvailableTools(user: AvailabilityUser): Promise<Tool[]> {
  const ctx = await resolveContext(user);
  return ALL_TOOLS.filter((tool) => passes(user, tool, ctx));
}

/** Single-tool gate — drives the tool.tsx 404 and the api.stream refusal. */
export async function isToolAvailable(user: AvailabilityUser, tool: Tool): Promise<boolean> {
  const ctx = await resolveContext(user);
  return passes(user, tool, ctx);
}

/**
 * The set of catalog model ids a caller may select, honoring the admin's
 * `enabledModels` allow-list. Only client-selectable models are ever eligible
 * (Opus-class stays server-only). Lockout guard: if the intersection is empty an
 * admin has effectively banned everything — fall back to the catalog default and
 * warn, because no admin may lock every user out of generation.
 */
export async function getSelectableModelIds(): Promise<Set<string>> {
  const enabled = await getEnabledModels();
  const catalog = listModels()
    .filter((m) => m.clientSelectable)
    .map((m) => m.id);
  const ids = catalog.filter((id) => enabled === null || enabled.includes(id));
  if (ids.length === 0) {
    log("availability_no_selectable_models", { fallback: DEFAULT_MODEL });
    return new Set([DEFAULT_MODEL]);
  }
  return new Set(ids);
}

/**
 * The catalog picker models a caller may choose (admin-enabled ∩ client-
 * selectable, with the lockout fallback). Local/discovered models are free and
 * always allowed, so they are added by the caller via `pickableModels`, not here.
 */
export async function getSelectableModels(): Promise<PickerModel[]> {
  const ids = await getSelectableModelIds();
  return listModels()
    .filter((m) => ids.has(m.id))
    .map((m) => ({ id: m.id, displayName: m.displayName, supportsImages: m.supportsImages }));
}

/**
 * Resolve one availability axis (country/sector/domain) to the catalogue slugs a
 * user may pick, under the Phase 12 OVERRIDE model. `selection` is the single set
 * that governs (see `axisSelection`); null/empty = no restriction (the whole
 * catalogue). A non-empty selection filters the catalogue; if it filters
 * everything away (a garbage/legacy slug), fall back to the whole catalogue and
 * warn — no editor may offer nothing.
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

/**
 * The single selection that governs a user's axis under the OVERRIDE model
 * (Phase 12). An *activated* teacher uses their own assignment — the instance is
 * ignored entirely, so they may pick beyond it (empty = all). Everyone else
 * (admin, unactivated teacher) follows the instance-enabled list. Returned raw
 * (null = no restriction) for `resolveAxis` to interpret. The `&&` short-circuit
 * keeps admins from ever touching the per-teacher getters.
 */
async function axisSelection(
  user: AvailabilityUser,
  instanceEnabled: () => Promise<string[] | null>,
  teacherAssigned: (id: string) => Promise<Set<string> | null>,
): Promise<Iterable<string> | null> {
  if (user.role === "teacher" && (await getUserContextCustomAccess(user.id))) {
    return teacherAssigned(user.id);
  }
  return instanceEnabled();
}

/**
 * The countries a teacher/admin may pick in the context editor. OVERRIDE model
 * (Phase 12): an activated teacher's own set wins (instance ignored, empty =
 * all); admins and unactivated teachers follow the instance-enabled set.
 * Students are N/A (no editor — their level comes from the cohort profile).
 */
export async function getAvailableCountries(user: AvailabilityUser): Promise<CountryCode[]> {
  const selection = await axisSelection(user, getEnabledCountries, getUserAssignedCountries);
  return resolveAxis(COUNTRIES, selection, "availability_no_available_countries");
}

/** The sectors a teacher/admin may pick in the context editor (see above). */
export async function getAvailableSectors(user: AvailabilityUser): Promise<Sector[]> {
  const selection = await axisSelection(user, getEnabledSectors, getUserAssignedSectors);
  return resolveAxis(SECTORS, selection, "availability_no_available_sectors");
}

/**
 * The flat domain/profiel allow-list that governs a user under the OVERRIDE model
 * (Phase 12): an activated teacher's own assignment (instance ignored, null =
 * all), else the instance domain set. `null` = no restriction. This is the
 * track-independent effective set the editor loader filters each catalogue by;
 * `getAvailableDomains` layers a specific (sector, track) catalogue on top.
 */
export async function getAvailableDomainSlugs(user: AvailabilityUser): Promise<string[] | null> {
  const selection = await axisSelection(user, getEnabledDomains, getUserAssignedDomains);
  return selection ? [...selection] : null;
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
