/**
 * The guided route through a dossier: the framework, then each learning outcome on its own
 * (evidence → chapter → review → shown), then finishing. Derived from what the dossier holds,
 * never stored; pure and advisory, like `readinessCheck`: it changes nothing and uses no AI.
 * The teacher's own mark decides: a coach verdict counts towards the review, never towards shown.
 */
import { wordCount } from "./progress";
import { readinessCheck, readinessSummary } from "./readiness";
import type { DossierData } from "./types";

const OUTCOME_MILESTONES = ["evidence", "chapter", "review", "shown"] as const;
export type OutcomeMilestone = (typeof OUTCOME_MILESTONES)[number];

export interface Milestone {
  id: OutcomeMilestone;
  complete: boolean;
  /** What is done of this milestone, out of `total` (criteria with evidence, …). */
  done: number;
  total: number;
  /** The first criterion still open, where it makes sense (evidence). */
  criterionId?: string;
}

interface OutcomeRoute {
  outcomeId: string;
  milestones: Milestone[];
  complete: boolean;
  /** The first milestone that is not complete, or null when all are. */
  next: Milestone | null;
}

export function outcomeRoute(d: DossierData, outcomeId: string): OutcomeRoute | null {
  const o = d.framework.outcomes.find((x) => x.id === outcomeId);
  if (!o) return null;
  const linked = new Set(d.evidence.flatMap((e) => e.criterionIds));
  const verdicts = new Map(
    (d.reviews?.[o.id]?.review.criteria ?? []).map((c) => [c.criterionId, c.verdict]),
  );
  const shown = (id: string) => d.status[id] === "shown";
  const chapter = d.chapters.find((ch) => ch.outcomeId === o.id);
  const words = chapter ? wordCount(chapter.text) : 0;
  const total = o.criteria.length;
  const step = (id: OutcomeMilestone, done: number, of: number, criterionId?: string) => ({
    id,
    done,
    total: of,
    complete: of > 0 && done === of,
    ...(criterionId ? { criterionId } : {}),
  });
  const milestones: Milestone[] = [
    step(
      "evidence",
      o.criteria.filter((c) => linked.has(c.id)).length,
      total,
      o.criteria.find((c) => !linked.has(c.id))?.id,
    ),
    step("chapter", words > 0 ? 1 : 0, 1),
    step(
      "review",
      o.criteria.filter((c) => shown(c.id) || verdicts.get(c.id) === "shown").length,
      total,
    ),
    step("shown", o.criteria.filter((c) => shown(c.id)).length, total),
  ];
  const next = milestones.find((m) => !m.complete) ?? null;
  return { outcomeId: o.id, milestones, complete: next === null, next };
}

export interface RouteStep {
  /** "framework", "finish", or the outcome's id. */
  id: string;
  kind: "framework" | "outcome" | "finish";
  outcomeId?: string;
  complete: boolean;
  /** Framework: confirmed or not. Outcome: milestones complete. Finish: points that block. */
  done: number;
  total: number;
  /** For an outcome: its next milestone. */
  milestone?: Milestone | null;
}

interface DossierRoute {
  steps: RouteStep[];
  complete: number;
  total: number;
  /** The first step that is not complete, or null when all are. */
  next: RouteStep | null;
}

export function dossierRoute(d: DossierData): DossierRoute {
  const outcomes = d.framework.outcomes.filter((o) => o.criteria.length > 0);
  const framework = outcomes.length > 0 && d.framework.confirmedAt !== undefined;
  const { blocking } = readinessSummary(readinessCheck(d));
  const steps: RouteStep[] = [
    { id: "framework", kind: "framework", complete: framework, done: framework ? 1 : 0, total: 1 },
    ...outcomes.flatMap((o): RouteStep[] => {
      const r = outcomeRoute(d, o.id);
      if (!r) return [];
      const step: RouteStep = {
        id: o.id,
        kind: "outcome",
        outcomeId: o.id,
        complete: r.complete,
        done: r.milestones.filter((m) => m.complete).length,
        total: r.milestones.length,
        milestone: r.next,
      };
      return [step];
    }),
    {
      id: "finish",
      kind: "finish",
      complete: framework && blocking === 0,
      done: 0,
      total: blocking,
    },
  ];
  return {
    steps,
    complete: steps.filter((s) => s.complete).length,
    total: steps.length,
    next: steps.find((s) => !s.complete) ?? null,
  };
}
