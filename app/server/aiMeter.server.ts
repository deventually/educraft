/**
 * Measures one model call for the daily quota (`usage`) and the usage dashboard
 * (`ai_usage`). The caller hands the call's tokens to `onUsage` (a streaming adapter does
 * so once the stream ends), then says how the call ended. Never throws: a metering
 * failure is logged and never breaks the answer the teacher is reading.
 */
import type { TokenUsage } from "~/lib/ai/types";
import { recordAiUsage } from "./repositories/aiUsage.server";
import { recordUsage } from "./repositories/usage.server";

export function meterCall(userId: string, source: string, model: string) {
  let usage: TokenUsage | undefined;
  const safely = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (e) {
      console.error("Failed to record usage:", e);
    }
  };
  return {
    onUsage(reported: TokenUsage) {
      usage = reported;
    },
    /** The call finished: counts against the quota and in the dashboard. */
    done(chars: number): Promise<void> {
      return safely(async () => {
        await recordUsage(userId, { chars, tokens: usage?.output });
        await recordAiUsage(userId, { source, model, usage });
      });
    },
    /** The call failed or was aborted: counted in the dashboard, tokens as far as known. */
    failed(): Promise<void> {
      return safely(() => recordAiUsage(userId, { source, model, usage, failed: true }));
    },
  };
}
