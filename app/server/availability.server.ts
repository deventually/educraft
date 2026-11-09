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
  getEnabledSectors,
  getEnabledDomains,
} from "./repositories/settings.server";
import { listTeamSettingsForUser } from "./repositories/teams.server";
import { featureKey, getExceptions, toolKey } from "./repositories/exceptions.server";

/** The caller: an account id and its role (`teacher` or `admin`). */
export interface AvailabilityUser {
  id: string;
  role: string;
}

export type { Decision };

// The model half (own set, team sets, the instance allow-list) lives in its own module.
export {
  effectiveDefaultModel,
  getSelectableModelIds,
  getSelectableModels,
  isModelSelectableForUser,
  narrowLocalModels,
  servedModelFor,
} from "./modelAvailability.server";

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
