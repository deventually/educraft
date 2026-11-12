/**
 * The admin's model registry on the server: read once from the database, installed
 * into the catalog (`installModelRegistry`), and re-installed on every save. One
 * process serves the app (SQLite), so an in-memory copy is the truth after a save; one copy
 * per institution, each read from its own database.
 */
import { EMPTY_REGISTRY, parseModelRegistry, type ModelRegistry } from "~/lib/ai/modelRegistry";
import {
  installModelRegistry,
  installedModelRegistry,
  setModelRegistryScope,
} from "~/lib/ai/models";
import { getModelRegistryJson, setModelRegistryJson } from "~/server/repositories/settings.server";
import { currentTenantOrNull } from "~/server/tenants.server";

// Every institution has its own admin and registry (tenants.server): lookups read its copy.
const scope = () => currentTenantOrNull()?.id ?? "";
setModelRegistryScope(scope);

/** The institutions whose stored registry is installed. */
const loaded = new Set<string>();

/** Make sure the stored registry is installed. Cheap after the first call. */
export async function syncModelRegistry(): Promise<void> {
  if (loaded.has(scope())) return;
  installModelRegistry(parseModelRegistry(await getModelRegistryJson()));
  loaded.add(scope());
}

/** The registry as installed now. */
export async function getModelRegistry(): Promise<ModelRegistry> {
  await syncModelRegistry();
  return installedModelRegistry();
}

/** Store and install a registry (round-tripped through the parser: only valid parts stay). */
export async function saveModelRegistry(registry: ModelRegistry): Promise<void> {
  const clean = parseModelRegistry(JSON.stringify(registry ?? EMPTY_REGISTRY));
  await setModelRegistryJson(JSON.stringify(clean));
  installModelRegistry(clean);
  loaded.add(scope());
}
