/**
 * The large parts of the app that can be switched on and off (P28.3). Data, not
 * branches: each entry is an id, a bilingual name and the instance default.
 * `effectiveFeatures` (`app/server/availability.server.ts`) applies the rule in
 * `./rule.ts`; nothing else in the code asks "is this feature X?".
 */
import { INSTANCE_STANDS, type InstanceStand } from "./rule";

export type FeatureId = "portfolio" | "courses" | "roleAgents" | "utilities";

export interface Feature {
  id: FeatureId;
  name: { nl: string; en: string };
  defaultStand: InstanceStand;
}

export const FEATURES: readonly Feature[] = [
  {
    id: "portfolio",
    name: { nl: "BDB/BKE-werkplaats", en: "BDB/BKE workplace" },
    defaultStand: "request",
  },
  { id: "courses", name: { nl: "Cursussen", en: "Courses" }, defaultStand: "on" },
  { id: "roleAgents", name: { nl: "Rolagenten", en: "Role agents" }, defaultStand: "on" },
  { id: "utilities", name: { nl: "Hulpmiddelen", en: "Utilities" }, defaultStand: "on" },
];

export const FEATURE_IDS = FEATURES.map((f) => f.id);
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
