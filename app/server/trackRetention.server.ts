/**
 * Wipes internship and thesis tracks once their `purgeAfter` has passed (P38, principle 4):
 * once a day, in every institution's own database, like `aiUsageRetention.server.ts`. Runs
 * whether or not the feature is on, so switching it off never keeps data longer. Never blocks a
 * request and never takes the app down: a failure is logged.
 */
import { log } from "./log.server";
import { purgeExpiredTracks } from "./repositories/tracks.server";
import { runWithTenant, servedTenants, type Tenant } from "./tenants.server";

const DAY = 24 * 60 * 60 * 1000;

/** Wipe what `now` no longer keeps; how many tracks went (a failing institution counts 0). */
export async function retainTracks(
  now = new Date(),
  tenants: readonly Tenant[] = servedTenants(),
): Promise<number> {
  let total = 0;
  for (const tenant of tenants) {
    try {
      const wiped = await runWithTenant(tenant, () => purgeExpiredTracks(now));
      if (wiped > 0) log("tracks.purged", { tenant: tenant.id, tracks: wiped });
      total += wiped;
    } catch (error) {
      log("tracks.purgeFailed", {
        tenant: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return total;
}

const globalForRetention = globalThis as unknown as { __limeonitTrackTimer?: NodeJS.Timeout };

/** Starts the daily wipe, once per process (and once right away). */
export function startTrackRetention(): void {
  if (globalForRetention.__limeonitTrackTimer) return;
  globalForRetention.__limeonitTrackTimer = setInterval(() => void retainTracks(), DAY);
  globalForRetention.__limeonitTrackTimer.unref();
  void retainTracks();
}
