/**
 * My own default model on /account (BESLUIT-2026-11-18-4): the model my tools start on,
 * before my team's and the institution's. I choose only from the models I may use
 * (`getSelectableModels`), and that is checked again on save, so an expensive model the
 * admin keeps out of the teachers' list can never become my default.
 */
import type { AvailabilityUser } from "./availability.server";
import { getSelectableModels } from "./availability.server";
import { getUserDefaultModel, setUserDefaultModel } from "./repositories/users.server";

export interface OwnDefaultModelView {
  current: string | null;
  options: { id: string; displayName: string }[];
}

export async function ownDefaultModelView(user: AvailabilityUser): Promise<OwnDefaultModelView> {
  const options = (await getSelectableModels(user)).map((m) => ({
    id: m.id,
    displayName: m.displayName,
  }));
  return { current: await getUserDefaultModel(user.id), options };
}

/** Save my default from the posted `defaultModel` ("" = none). */
export async function saveOwnDefaultModel(
  user: AvailabilityUser,
  fd: FormData,
): Promise<{ saved: true } | { error: "invalid" }> {
  const id = String(fd.get("defaultModel") ?? "").trim();
  if (id && !(await getSelectableModels(user)).some((m) => m.id === id)) {
    return { error: "invalid" };
  }
  await setUserDefaultModel(user.id, id || null);
  return { saved: true };
}
