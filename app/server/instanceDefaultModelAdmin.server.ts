/**
 * The institution's default model on the admin's models page (BESLUIT-2026-11-18-4): ""
 * clears it; otherwise a catalogue model the instance has on. Goes in the audit log.
 */
import { fullCatalog } from "./modelCatalog.server";
import { recordAdminAction } from "./repositories/auditLog.server";
import { getEnabledModels, setDefaultModel } from "./repositories/settings.server";

export async function saveInstanceDefaultModel(
  fd: FormData,
  actorUserId: string,
): Promise<{ saved: true } | { error: "invalid" }> {
  const id = String(fd.get("defaultModel") ?? "").trim();
  if (id !== "") {
    const enabled = await getEnabledModels();
    const inCatalog = (await fullCatalog()).some((m) => m.id === id);
    const on = enabled === null || enabled.length === 0 || enabled.includes(id);
    if (!inCatalog || !on) return { error: "invalid" };
  }
  await setDefaultModel(id || null);
  await recordAdminAction({
    actorUserId,
    action: "instanceDefaultModelChanged",
    detail: { models: id ? [id] : null },
  });
  return { saved: true };
}
