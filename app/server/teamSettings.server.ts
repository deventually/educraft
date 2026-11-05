/**
 * What a team may choose (P28.3) and how a posted team form becomes stored choices.
 * Shared by the admin (`/admin/teams`) and the team lead (`/teams/:id`): both see only
 * what the instance has not Off, and a model set only within the instance.
 */
import { ALL_TOOLS } from "~/lib/registry";
import { FEATURES } from "~/lib/features";
import { type Choice, isChoice } from "~/lib/features/rule";
import type { TeamSettings } from "~/lib/features/teamSettings";
import type { LocalizedText } from "~/lib/i18n/localized";
import { getFeatureStands, getToolStands } from "./repositories/settings.server";
import { getInvalidToolSlugs } from "~/lib/registry/boot.server";
import { getSelectableModels } from "./availability.server";

export interface TeamSettingsOffer {
  features: { id: string; name: LocalizedText }[];
  tools: { slug: string; name: LocalizedText }[];
  models: { id: string; displayName: string }[];
}

/** The features, tools and models a team can choose: everything the instance has not Off. */
export async function getTeamSettingsOffer(): Promise<TeamSettingsOffer> {
  const [featureStands, toolStands, models] = await Promise.all([
    getFeatureStands(),
    getToolStands(),
    getSelectableModels(),
  ]);
  const invalid = getInvalidToolSlugs();
  return {
    features: FEATURES.filter((f) => (featureStands[f.id] ?? f.defaultStand) !== "off").map(
      (f) => ({ id: f.id, name: f.name }),
    ),
    tools: ALL_TOOLS.filter(
      (t) =>
        !invalid.has(t.slug) && (toolStands.get(t.slug) ?? (t.enabled ? "on" : "off")) !== "off",
    ).map((t) => ({ slug: t.slug, name: t.name })),
    models: models.map((m) => ({ id: m.id, displayName: m.displayName })),
  };
}

/**
 * Apply a posted team form to the stored choices. Fields: `feature:<id>` and
 * `tool:<slug>` with "on", "off" or "" (no choice), and `modelMode` ("own" | "inherit")
 * with `models`. Only offered items change; a choice for something the instance has Off
 * stays stored (it never counts while the instance says Off). Absent `modelMode` leaves
 * the models alone.
 */
export function applyTeamSettingsForm(
  current: TeamSettings,
  fd: FormData,
  offer: TeamSettingsOffer,
): TeamSettings | { error: "invalid" | "atLeastOne" } {
  const merge = (
    stored: Record<string, Choice>,
    prefix: string,
    ids: string[],
  ): Record<string, Choice> | null => {
    const next = { ...stored };
    for (const id of ids) {
      const raw = fd.get(`${prefix}${id}`);
      if (raw === null) continue;
      const v = String(raw);
      if (v === "") delete next[id];
      else if (isChoice(v)) next[id] = v;
      else return null;
    }
    return next;
  };
  const features = merge(
    current.features,
    "feature:",
    offer.features.map((f) => f.id),
  );
  const tools = merge(
    current.tools,
    "tool:",
    offer.tools.map((t) => t.slug),
  );
  if (!features || !tools) return { error: "invalid" };

  let models = current.models;
  const mode = fd.get("modelMode");
  if (mode === "inherit") models = null;
  else if (mode === "own") {
    const allowed = new Set(offer.models.map((m) => m.id));
    const chosen = [...new Set(fd.getAll("models").map(String))].filter((id) => allowed.has(id));
    if (chosen.length === 0) return { error: "atLeastOne" };
    models = chosen;
  } else if (mode !== null) return { error: "invalid" };

  return { features, tools, models };
}
