/**
 * The large parts of the app that can be switched on and off (P28.3). Data, not
 * branches: each entry is an id, a bilingual name and the instance default.
 * `effectiveFeatures` (`app/server/availability.server.ts`) applies the rule in
 * `./rule.ts`; nothing else in the code asks "is this feature X?".
 */
import { INSTANCE_STANDS, type InstanceStand } from "./rule";

export type FeatureId = "portfolio" | "courses" | "roleAgents" | "utilities" | "pilotCheckin";

export interface Feature {
  id: FeatureId;
  name: { nl: string; en: string };
  defaultStand: InstanceStand;
  /**
   * Only the instance (and an admin's exception per teacher) switches it; a team has no
   * say, and a stored team choice never counts (BESLUIT-2026-11-05-11).
   */
  instanceOnly?: true;
}

export const FEATURES: readonly Feature[] = [
  {
    id: "portfolio",
    name: { nl: "BDB/BKE-werkplaats", en: "BDB/BKE workplace" },
    defaultStand: "request",
  },
  { id: "courses", name: { nl: "Cursussen", en: "Courses" }, defaultStand: "on" },
  {
    id: "roleAgents",
    name: { nl: "Rolagenten", en: "Role agents" },
    defaultStand: "on",
    instanceOnly: true,
  },
  { id: "utilities", name: { nl: "Hulpmiddelen", en: "Utilities" }, defaultStand: "on" },
  // The periodic pilot check-in on the home page; switch it off when the pilot ends.
  { id: "pilotCheckin", name: { nl: "Pilot-check-in", en: "Pilot check-in" }, defaultStand: "on" },
];

const FEATURE_IDS = FEATURES.map((f) => f.id);
export const isFeatureId = (v: unknown): v is FeatureId =>
  typeof v === "string" && (FEATURE_IDS as string[]).includes(v);

/** Problems with the register (checked at boot, like the tool registry). */
export function validateFeatures(features: readonly Feature[]): string[] {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    if (seen.has(f.id)) issues.push(`${f.id}: duplicate id`);
    seen.add(f.id);
    if (!f.name?.nl?.trim() || !f.name?.en?.trim()) issues.push(`${f.id}: name needs nl and en`);
    if (!(INSTANCE_STANDS as readonly string[]).includes(f.defaultStand)) {
      issues.push(`${f.id}: unknown default stand "${f.defaultStand}"`);
    }
  }
  return issues;
}
