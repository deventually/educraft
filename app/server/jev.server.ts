/**
 * The one gate for a call to TypeSafe's Jev (BESLUIT-2026-11-17-1). Every use of Jev asks
 * `jevAccess()` first and sends nothing when it is `null`: the admin's switch is off (the
 * default; on is the institution's consent to sending to Jev via OpenRouter), Jev is not in
 * `config/models.json`, or Jev's own key is missing. The switch is instance-wide: no team or
 * teacher choice reaches it.
 */
import type { JevSwitchState } from "~/components/admin/JevSwitch";
import { DECISIONS } from "~/lib/ai/models";
import { providerSetting } from "./env.server";
import { recordAdminAction } from "./repositories/auditLog.server";
import { getJevConsent, getTimeZone, setJevConsent } from "./repositories/settings.server";
import { getUserById } from "./repositories/users.server";

/** What a call to Jev needs: the Decisions API's address, the pinned model, its provider, the key. */
export interface JevAccess {
  url: string;
  model: string;
  provider: string;
  apiKey: string;
}

/** Jev for this request's institution, or `null` when nothing may go to Jev. */
export async function jevAccess(): Promise<JevAccess | null> {
  if (!DECISIONS) return null;
  const apiKey = providerSetting(DECISIONS.keyEnv);
  if (!apiKey || !(await getJevConsent()).on) return null;
  const { url, model, provider } = DECISIONS;
  return { url, model, provider, apiKey };
}

/** Whether Jev's own key is set (the admin page says so next to the switch). */
function jevKeySet(): boolean {
  return DECISIONS !== null && providerSetting(DECISIONS.keyEnv) !== undefined;
}

/** The switch as Beheer → Tools shows it: stand, who and when, whether the key is set. */
export async function jevSwitchState(): Promise<JevSwitchState> {
  const consent = await getJevConsent();
  const byName = consent.by ? (await getUserById(consent.by))?.name : undefined;
  return {
    on: consent.on,
    keySet: jevKeySet(),
    ...(byName ? { byName } : {}),
    ...(consent.at ? { at: consent.at, timeZone: await getTimeZone() } : {}),
  };
}

/**
 * An admin switches Jev on or off. A change records the admin and the time on the switch and a
 * line in the audit log (switching on is the institution's consent); saving the same stand
 * changes nothing, so the record of who consented stays.
 */
export async function switchJev(actorUserId: string, on: boolean): Promise<void> {
  if ((await getJevConsent()).on === on) return;
  await setJevConsent(on, actorUserId);
  await recordAdminAction({ actorUserId, action: on ? "jevSwitchedOn" : "jevSwitchedOff" });
}
