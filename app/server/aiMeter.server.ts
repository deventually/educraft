/**
 * Measures one model call for the daily quota (`usage`) and the usage dashboard
 * (`ai_usage`). The caller hands the call's tokens to `onUsage` (a streaming adapter does
 * so once the stream ends), then says how the call ended. The call is priced at the
 * model's price of that moment (the admin's, else the catalog's); a local model costs nothing. Never throws: a metering
 * failure is logged and never breaks the answer the teacher is reading.
 */
import {
  effectivePrice,
  isResolvableModel,
  LOCAL_PROVIDERS,
  resolveModelInfo,
} from "~/lib/ai/models";
import { callCost } from "~/lib/ai/prices";
import type { TokenUsage } from "~/lib/ai/types";
import { recordAiUsage } from "./repositories/aiUsage.server";
import { getModelPrices } from "./repositories/modelPrices.server";
import { recordUsage } from "./repositories/usage.server";

function isLocalModel(model: string): boolean {
  if (!isResolvableModel(model)) return false;
  return (LOCAL_PROVIDERS as readonly string[]).includes(resolveModelInfo(model).provider);
}

/** Millionths of a euro, or undefined when the tokens or the price are unknown. */
async function costOf(model: string, usage: TokenUsage | undefined): Promise<number | undefined> {
  if (!usage) return undefined;
  if (isLocalModel(model)) return 0;
  return callCost(usage, effectivePrice(model, await getModelPrices())?.price);
}

export function meterCall(userId: string, source: string, model: string) {
  let usage: TokenUsage | undefined;
  const safely = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      console.error("Failed to record usage:", e);
    }
  };
  const record = async (failed: boolean) =>
    recordAiUsage(userId, { source, model, usage, failed, costMicros: await costOf(model, usage) });
  return {
    onUsage(reported: TokenUsage) {
      usage = reported;
    },
    /** The call finished: counts against the quota and in the dashboard. */
    done(chars: number): Promise<void> {
      return safely(async () => {
        await recordUsage(userId, { chars, tokens: usage?.output });
        await record(false);
      });
    },
    /** The call failed or was aborted: counted in the dashboard, tokens as far as known. */
    failed(): Promise<void> {
      return safely(() => record(true));
    },
  };
}
