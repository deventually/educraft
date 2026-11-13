/**
 * Repository rule: all DB access goes through repositories; every exported function is
 * `async` and scoped to its owning `userId`.
 *
 * AI use per user, day, source and model (`ai_usage`): what each call cost in tokens,
 * the same for every provider. Feeds the usage dashboard; the daily quota stays in `usage`.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { isResolvableModel, resolveModelInfo } from "~/lib/ai/models";
import type { TokenUsage } from "~/lib/ai/types";
import { getDb } from "../db.server";
import { aiUsage } from "../schema.server";
import { utcDay } from "./usage.server";

export interface AiCall {
  /** The tool slug, or a fixed source for calls outside the tool stream. */
  source: string;
  /** The served model id; its provider is looked up in the catalog. */
  model: string;
  /** The provider, for a model outside the catalog (the decision model, `DECISIONS`). */
  provider?: string;
  /** The call's tokens; absent when the provider reported none (or the call broke off). */
  usage?: TokenUsage;
  /** The call failed or was aborted. */
  failed?: boolean;
  /** What the call cost in millionths of a euro; absent = no price (or no tokens) known. */
  costMicros?: number;
}

/** The model's provider, or "unknown" for an id the catalog no longer knows. */
function providerOf(model: string): string {
  return isResolvableModel(model) ? resolveModelInfo(model).provider : "unknown";
}

/** Count one model call (upsert): +1 call, + its tokens, or +1 unmetered when unknown. */
export async function recordAiUsage(userId: string, call: AiCall, day = utcDay()): Promise<void> {
  const t = call.usage;
  const add = {
    calls: 1,
    failedCalls: call.failed ? 1 : 0,
    unmeteredCalls: t ? 0 : 1,
    inputTokens: t?.input ?? 0,
    cacheReadTokens: t?.cacheRead ?? 0,
    cacheWriteTokens: t?.cacheWrite ?? 0,
    outputTokens: t?.output ?? 0,
    reasoningTokens: t?.reasoning ?? 0,
    costMicros: call.costMicros ?? 0,
    unpricedCalls: call.costMicros === undefined ? 1 : 0,
  };
  const inc = (col: (typeof aiUsage)[keyof typeof add], by: number) => sql`${col} + ${by}`;
  getDb()
    .insert(aiUsage)
    .values({
      id: randomUUID(),
      userId,
      day,
      source: call.source,
      provider: call.provider ?? providerOf(call.model),
      model: call.model,
      ...add,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day, aiUsage.source, aiUsage.model],
      set: {
        calls: inc(aiUsage.calls, add.calls),
        failedCalls: inc(aiUsage.failedCalls, add.failedCalls),
        unmeteredCalls: inc(aiUsage.unmeteredCalls, add.unmeteredCalls),
        inputTokens: inc(aiUsage.inputTokens, add.inputTokens),
        cacheReadTokens: inc(aiUsage.cacheReadTokens, add.cacheReadTokens),
        cacheWriteTokens: inc(aiUsage.cacheWriteTokens, add.cacheWriteTokens),
        outputTokens: inc(aiUsage.outputTokens, add.outputTokens),
        reasoningTokens: inc(aiUsage.reasoningTokens, add.reasoningTokens),
        costMicros: inc(aiUsage.costMicros, add.costMicros),
        unpricedCalls: inc(aiUsage.unpricedCalls, add.unpricedCalls),
      },
    })
    .run();
}

/** The user's rows from `sinceDay` (a UTC "YYYY-MM-DD") on, oldest first. */
export async function listAiUsage(userId: string, sinceDay: string) {
  return getDb()
    .select({
      day: aiUsage.day,
      source: aiUsage.source,
      provider: aiUsage.provider,
      model: aiUsage.model,
      calls: aiUsage.calls,
      failedCalls: aiUsage.failedCalls,
      unmeteredCalls: aiUsage.unmeteredCalls,
      inputTokens: aiUsage.inputTokens,
      cacheReadTokens: aiUsage.cacheReadTokens,
      cacheWriteTokens: aiUsage.cacheWriteTokens,
      outputTokens: aiUsage.outputTokens,
      reasoningTokens: aiUsage.reasoningTokens,
      costMicros: aiUsage.costMicros,
      unpricedCalls: aiUsage.unpricedCalls,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.day, sinceDay)))
    .orderBy(asc(aiUsage.day), asc(aiUsage.source), asc(aiUsage.model))
    .limit(500)
    .all();
}
