/**
 * Changing and removing a model the admin added on screen (the models page). Its provider
 * and API id stay: they make its id, and results and counts point at that id. A model goes
 * only while nothing has used it or names it; otherwise the admin phases it out with an
 * upgrade, so old work keeps its model. Both are logged.
 */
import { type ModelSettings, resolveModelInfo } from "~/lib/ai/models";
import { editModel, removeModel } from "~/lib/ai/modelRegistry";
import { getModelRegistry, saveModelRegistry } from "./modelRegistry.server";
import { recordAdminAction } from "./repositories/auditLog.server";
import { modelHasHistory, modelNamedInSettings } from "./repositories/modelReferences.server";
import { setModelPrice } from "./repositories/modelPrices.server";
import { getEnabledModels, setEnabledModels } from "./repositories/settings.server";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const EFFORTS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

/** Effort and temperature from the add or edit form; empty = the provider's default. */
export function formSettings(fd: FormData): { settings?: ModelSettings } {
  const settings: ModelSettings = {};
  const effort = text(fd, "effort");
  if ((EFFORTS as readonly string[]).includes(effort)) {
    settings.effort = effort as ModelSettings["effort"];
  }
  const temp = text(fd, "temperature").replace(",", ".");
  if (temp !== "") {
    const n = Number(temp);
    // Out of range is refused by the registry's own check (an "invalid" toast).
    settings.temperature = Number.isFinite(n) ? n : -1;
  }
  return Object.keys(settings).length ? { settings } : {};
}

/** The switches of the add or edit form. */
export function formSwitches(fd: FormData) {
  return {
    supportsImages: fd.get("supportsImages") === "on",
    alwaysThinks: fd.get("alwaysThinks") === "on",
    clientSelectable: fd.get("clientSelectable") === "on",
  };
}

export async function editAdminModel(id: string, fd: FormData, actorUserId: string) {
  const registry = await getModelRegistry();
  if (!registry.added.some((m) => m.id === id)) return { error: "notAdded" };
  const displayName = text(fd, "displayName");
  const res = editModel(registry, id, { displayName, ...formSwitches(fd), ...formSettings(fd) });
  if (!res.ok) return { error: "invalid" };
  await saveModelRegistry(res.registry);
  await recordAdminAction({ actorUserId, action: "modelEdited", detail: { models: [id] } });
  return { edited: displayName };
}

export async function removeAdminModel(id: string, actorUserId: string) {
  const registry = await getModelRegistry();
  if (!registry.added.some((m) => m.id === id)) return { error: "notAdded" };
  const name = resolveModelInfo(id).displayName;
  if (await modelHasHistory(id)) return { error: "used" };
  if (await modelNamedInSettings(id)) return { error: "named" };
  const res = removeModel(registry, id);
  if (!res.ok) return { error: res.error };
  await saveModelRegistry(res.registry);
  const enabled = await getEnabledModels();
  if (enabled?.includes(id)) await setEnabledModels(enabled.filter((m) => m !== id));
  await setModelPrice(id, null);
  await recordAdminAction({ actorUserId, action: "modelRemoved", detail: { models: [id] } });
  return { removed: name };
}
