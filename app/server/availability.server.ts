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
} from "./repositories/settings.server";
import {
  getUserToolAllowlist,
  getUserAssignedCountries,
  getUserAssignedSectors,
  getUserAssignedDomains,
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
 * Compose the shipped catalogue with an instance allow-list and a per-teacher
 * assignment — each layer default-open (null = no restriction). Mirrors the model
 * lockout guard: if the intersection is empty, someone has locked everyone out,
 * so fall back to the full catalogue and warn (no editor may offer nothing).
 */
function composeAvailable<T extends string>(
  catalogue: readonly T[],
  instanceEnabled: string[] | null,
  teacherAssigned: Set<string> | null,
  lockoutKey: string,
): T[] {
  let ids = [...catalogue];
  if (instanceEnabled) ids = ids.filter((x) => instanceEnabled.includes(x));
  if (teacherAssigned) ids = ids.filter((x) => teacherAssigned.has(x));
  if (ids.length === 0) {
    log(lockoutKey, { fallback: "all" });
    return [...catalogue];
  }
  return ids;
}

/**
 * The countries a teacher/admin may pick in the context editor (Phase 8):
 * shipped catalogue ∩ instance-enabled ∩ per-teacher-assigned. Per-teacher
 * assignment applies to teachers only; admins get the instance-enabled set.
 * Students are N/A (no editor — their level comes from the cohort profile).
 */
export async function getAvailableCountries(user: AvailabilityUser): Promise<CountryCode[]> {
  const assigned = user.role === "teacher" ? await getUserAssignedCountries(user.id) : null;
  return composeAvailable(
    COUNTRIES,
    await getEnabledCountries(),
    assigned,
    "availability_no_available_countries",
  );
}

/** The sectors a teacher/admin may pick in the context editor (see above). */
export async function getAvailableSectors(user: AvailabilityUser): Promise<Sector[]> {
  const assigned = user.role === "teacher" ? await getUserAssignedSectors(user.id) : null;
  return composeAvailable(
    SECTORS,
    await getEnabledSectors(),
    assigned,
    "availability_no_available_sectors",
  );
}

/**
 * The domains/profielen a teacher/admin may pick for a given (sector, track) —
 * the track-scoped catalogue ∩ the per-teacher assignment (Phase 10.3). No
 * instance-level domain axis (per-teacher only). An empty catalogue (mbo/wo, or
 * a vo sector with no track yet) short-circuits to [] — no lockout warning, since
 * "no catalogue" isn't "everything banned". Otherwise the composeAvailable
 * lockout guard applies: an assignment excluding every catalogue slug falls back
 * to the full catalogue and warns (no editor may offer nothing).
 */
export async function getAvailableDomains(
  user: AvailabilityUser,
  sector: string | undefined,
  track: string | undefined,
): Promise<string[]> {
  const catalogue = getDomainsForTrack(DEFAULT_COUNTRY, sector, track).map((d) => d.value);
  if (catalogue.length === 0) return [];
  const assigned = user.role === "teacher" ? await getUserAssignedDomains(user.id) : null;
  return composeAvailable(catalogue, null, assigned, "availability_no_available_domains");
}
