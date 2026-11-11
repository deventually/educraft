import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * AI use per user, UTC day, source (a tool slug, or a fixed source such as
 * `portfolio-coach`) and model: the measurement behind the usage dashboard. Counters
 * only, never content and never a time of day. `inputTokens + cacheReadTokens +
 * cacheWriteTokens` is the whole prompt (`normalizeUsage`). `unmeteredCalls` are calls
 * whose provider reported no tokens, so their tokens are unknown rather than zero.
 * `costMicros` adds up what the priced calls cost; `unpricedCalls` counts the rest.
 * Re-exported by `schema.server.ts`.
 */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    day: text("day").notNull(),
    source: text("source").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    calls: integer("calls").notNull().default(0),
    failedCalls: integer("failed_calls").notNull().default(0),
    unmeteredCalls: integer("unmetered_calls").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    reasoningTokens: integer("reasoning_tokens").notNull().default(0),
    // Millionths of a euro, priced when counted (a snapshot); calls without a price add 0
    // here and 1 to `unpricedCalls`, so a total is never silently too low.
    costMicros: integer("cost_micros").notNull().default(0),
    unpricedCalls: integer("unpriced_calls").notNull().default(0),
  },
  (t) => [uniqueIndex("ai_usage_key").on(t.userId, t.day, t.source, t.model)],
);
