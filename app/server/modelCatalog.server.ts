import { listModels } from "~/lib/ai/models";
import { discoverLocalModels } from "~/lib/ai/discover.server";
import { localModelsEnabled } from "~/server/env.server";

/** Which section a model belongs to in the UI: frontier API, CLI agent, or
 *  a locally-discovered (Ollama/LM Studio) model. */
export type ModelGroup = "frontier" | "cli" | "local";
export type CatalogModel = { id: string; displayName: string; group: ModelGroup };

/**
 * Every model that can be offered — client-selectable only (Opus-class stays
 * server-side). CLI agents and discovered local models are part of the catalogue
 * only outside production (`localModelsEnabled`, P18): in production they do not
 * exist for the app, so they are neither listed nor probed.
 */
export async function fullCatalog(): Promise<CatalogModel[]> {
  const local = localModelsEnabled();
  const staticModels: CatalogModel[] = listModels()
    .filter((m) => m.clientSelectable && (local || !m.local))
    .map((m) => ({
      id: m.id as string,
      displayName: m.displayName,
      group: m.local ? "cli" : "frontier",
    }));
  const discovered: CatalogModel[] = local
    ? (await discoverLocalModels()).map((m) => ({
        id: m.id,
        displayName: m.displayName,
        group: "local",
      }))
    : [];
  return [...staticModels, ...discovered];
}
