/**
 * Post-session summariser orchestration (Phase 7). Builds the `session-summary`
 * system prompt with the transcript embedded as delimited material, calls the
 * model (injected as `complete`, so this is unit-testable without the network),
 * and validates + leak-checks the output. On a malformed/leaky result it retries
 * once, then gives up and returns `null` — never a partial leak.
 */
import type { OutputLanguage } from "~/lib/registry/types";
import { getRuntimePrompt } from "~/lib/prompts";
import { interpolate } from "~/lib/template/interpolate";
import { validateSummaryOutput, type SessionSummary } from "./summary";

const SUMMARY_PROMPT_ID = "session-summary@v1";

const TRIGGER: Record<OutputLanguage, string> = {
  nl: "Geef de samenvatting als één JSON-object.",
  en: "Produce the summary as a single JSON object.",
};

/** Build the summariser system prompt with the transcript embedded. */
export function buildSummarySystemPrompt(
  transcript: string,
  outputLanguage: OutputLanguage,
): string {
  const template = getRuntimePrompt(SUMMARY_PROMPT_ID, outputLanguage);
  return interpolate(template, { transcript });
}

export interface SummariseSessionOptions {
  transcript: string;
  outputLanguage: OutputLanguage;
  /** Injected model call — returns the raw completion text. */
  complete: (args: { system: string; user: string }) => Promise<string>;
}

/**
 * Summarise one session. Returns a validated, de-personalised summary, or `null`
 * if the model failed to produce a clean one within one retry.
 */
export async function summariseSession(
  opts: SummariseSessionOptions,
): Promise<SessionSummary | null> {
  const system = buildSummarySystemPrompt(opts.transcript, opts.outputLanguage);
  const user = TRIGGER[opts.outputLanguage];
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await opts.complete({ system, user });
    } catch {
      continue;
    }
    const summary = validateSummaryOutput(raw, opts.transcript);
    if (summary) return summary;
  }
  return null;
}
