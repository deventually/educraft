import type { TokenUsage } from "./types";

/**
 * A provider's token report as the AI SDK hands it over (`LanguageModelUsage`), loosened so
 * adapters without the details (Ollama, a test double) can pass what they have.
 */
interface ReportedUsage {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  inputTokenDetails?: {
    noCacheTokens?: number | undefined;
    cacheReadTokens?: number | undefined;
    cacheWriteTokens?: number | undefined;
  };
  outputTokenDetails?: { textTokens?: number | undefined; reasoningTokens?: number | undefined };
}

/**
 * One shape for every provider. Anthropic reports uncached input apart from cache reads and
 * writes; OpenAI-compatible providers report a total with a cached share; local models report
 * no cache. `input + cacheRead + cacheWrite` is always the whole prompt. `undefined` = the
 * provider said nothing, so the call is counted but its tokens (and price) are unknown.
 */
export function normalizeUsage(reported: ReportedUsage | undefined): TokenUsage | undefined {
  if (!reported || (reported.inputTokens === undefined && reported.outputTokens === undefined)) {
    return undefined;
  }
  const details = reported.inputTokenDetails;
  const cacheRead = details?.cacheReadTokens ?? 0;
  const cacheWrite = details?.cacheWriteTokens ?? 0;
  const input =
    details?.noCacheTokens ?? Math.max(0, (reported.inputTokens ?? 0) - cacheRead - cacheWrite);
  return {
    input,
    cacheRead,
    cacheWrite,
    output: reported.outputTokens ?? 0,
    reasoning: reported.outputTokenDetails?.reasoningTokens ?? 0,
  };
}
