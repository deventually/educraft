/**
 * Keeps `ai_usage` per person for thirteen months (BESLUIT-2026-11-11-6): every hour the server
 * rolls older rows up into month totals without a person (`rollUpAiUsage`). Usually there is
 * nothing to do; on the first of a month one month goes. Never blocks a request and never takes
 * the app down: a failure is logged.
 */
import { log } from "./log.server";
import { retentionCutoff, rollUpAiUsage } from "./repositories/aiUsageRollup.server";
import { servedTenants, runWithTenant, type Tenant } from "./tenants.server";

const HOUR = 60 * 60 * 1000;

/**
 * Roll up what `now` no longer keeps per person, in every institution's own database; how many
 * person rows went (a failing institution counts 0 and is logged).
 */
export async function retainAiUsage(
  now = new Date(),
  tenants: readonly Tenant[] = servedTenants(),
): Promise<number> {
  let total = 0;
  for (const tenant of tenants) {
    try {
      const cutoff = retentionCutoff(now.toISOString().slice(0, 10));
      const moved = await runWithTenant(tenant, () => rollUpAiUsage(cutoff));
      if (moved > 0) log("aiUsage.rolledUp", { tenant: tenant.id, rows: moved });
      total += moved;
    } catch (error) {
      log("aiUsage.rollUpFailed", {
        tenant: tenant.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return total;
}

const globalForRetention = globalThis as unknown as { __limeonitAiUsageTimer?: NodeJS.Timeout };

/** Starts the hourly roll-up, once per process. */
export function startAiUsageRetention(): void {
  if (globalForRetention.__limeonitAiUsageTimer) return;
  globalForRetention.__limeonitAiUsageTimer = setInterval(() => void retainAiUsage(), HOUR);
  globalForRetention.__limeonitAiUsageTimer.unref();
  void retainAiUsage();
}
