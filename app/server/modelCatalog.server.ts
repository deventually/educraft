import { isResolvableModel, listModels, modelState, resolveModelInfo } from "~/lib/ai/models";
import { syncModelRegistry } from "./modelRegistry.server";
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
 * exist for the app, so they are neither listed nor probed. A model being upgraded is
 * not a choice any more: its newest version stands in for it.
 */
export async function fullCatalog(): Promise<CatalogModel[]> {
  await syncModelRegistry();
  const local = localModelsEnabled();
  const staticModels: CatalogModel[] = listModels()
    .filter((m) => m.clientSelectable && (local || !m.local) && modelState(m.id) === "active")
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

/**
 * An expensive model the admin may switch on per team or teacher (BESLUIT-2026-11-18-5):
 * an API model teachers may not pick themselves (not client-selectable), not retired.
 */
export function isGrantable(id: string): boolean {
  if (!isResolvableModel(id) || modelState(id) === "retired") return false;
  const info = resolveModelInfo(id);
  return !info.clientSelectable && !info.local;
}

/** The expensive models to offer the admin per team or teacher: grantable and active. */
export async function expensiveCatalog(): Promise<{ id: string; displayName: string }[]> {
  await syncModelRegistry();
  return listModels()
    .filter((m) => isGrantable(m.id) && modelState(m.id) === "active")
    .map((m) => ({ id: m.id as string, displayName: m.displayName }));
}
