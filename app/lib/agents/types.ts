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
  /** One line on what the hat looks at, shown where the teacher ticks it. */
  focus: LocalizedText;
  /** Whether the hat looks along for a teacher who never chose (the teacher's own switch). */
  teacherDefault: AgentStand;
}

/**
 * A hat's stand: On or Off. Used for the instance switch on /admin/agents (an untouched hat
 * is on) and for a teacher's own choice (an untouched hat follows `teacherDefault`).
 */
export const AGENT_STANDS = ["on", "off"] as const;
export type AgentStand = (typeof AGENT_STANDS)[number];
export const isAgentStand = (v: unknown): v is AgentStand =>
  typeof v === "string" && (AGENT_STANDS as readonly string[]).includes(v);

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

/** A stored finding (P21.3): the filtered finding plus a stable id within its review. */
export interface ReviewFinding extends AgentFinding {
  /** `f1`, `f2`, ... in the order the hat returned them. */
  id: string;
}

/** What the teacher says about one finding. Accepting only records it (no task list). */
export const DECISIONS = ["accepted", "rejected"] as const;
export type Decision = (typeof DECISIONS)[number];

/** Upper bound on the teacher's optional reason. */
export const DECISION_REASON_MAX = 500;

/** What the course page's review panel shows for one hat: its latest review, if any (P21.5). */
export interface ReviewPanelAgent {
  agentId: string;
  role: LocalizedText;
  review: null | {
    id: string;
    /** Display name of the model the hat ran on. */
    model: string;
    /** The course changed after this review. */
    stale: boolean;
    findings: (ReviewFinding & { decision?: Decision; reason?: string | null })[];
  };
}

/** One hat the teacher can tick in the review panel: the admin has it on. */
export interface ReviewPanelChoice {
  agentId: string;
  role: LocalizedText;
  focus: LocalizedText;
  /** The teacher chose it (or never chose and it is on by default). */
  chosen: boolean;
}
