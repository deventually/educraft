/**
 * Role agents ("hats", brief P21). A hat is data: who it is, which prompt it
 * speaks with and what it may look at. There is no control flow per hat.
 * Hats advise; they never change a course (BESLUIT-2026-11-02-4).
 */
import type { LocalizedText } from "~/lib/i18n/localized";

export const AGENT_TARGETS = ["course", "generation"] as const;
export type AgentTarget = (typeof AGENT_TARGETS)[number];

export interface Agent {
  id: string;
  /** Shown to the teacher, e.g. "Toetsdeskundige". */
  role: LocalizedText;
  /** Versioned prompt id (`<id>@vN`); the prompt itself arrives in P21.2. */
  promptId: string;
  watches: AgentTarget[];
}

export const SEVERITIES = ["warning", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

/** One piece of advice, after it passed the schema and the filter. */
export interface AgentFinding {
  severity: Severity;
  /** The real id of the outcome, activity or assessment; absent = about the whole course. */
  targetId?: string;
  message: string;
  suggestion: string;
}

/** A finding the teacher rejected earlier: the hat must not raise it again. */
export interface RejectedFinding {
  targetId?: string;
  message: string;
}
