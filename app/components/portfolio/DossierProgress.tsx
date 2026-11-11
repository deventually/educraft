import { Link } from "react-router";
import { ProgressPanel } from "~/components/progress/ProgressPanel";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { outcomeLabel } from "~/lib/portfolio/format";
import type { Milestone, OutcomeMilestone, RouteStep, dossierRoute } from "~/lib/portfolio/route";
import { type OutcomeTab, dossierHref, outcomeHref } from "~/lib/portfolio/tabs";
import type { Outcome } from "~/lib/portfolio/types";

/** Where each milestone is done: its tab of the outcome page, and the part of that tab. */
const MILESTONE_PLACE: Record<OutcomeMilestone, [OutcomeTab, string]> = {
  evidence: ["evidence", "evidence-title"],
  chapter: ["chapter", "chapter-title"],
  review: ["review", "coach-title"],
  shown: ["review", "status-title"],
};

const milestoneHref = (dossierId: string, outcomeId: string, m: OutcomeMilestone) =>
  outcomeHref(dossierId, outcomeId, ...MILESTONE_PLACE[m]);

/** The section of the BDB/BKE guide that explains a step. */
const GUIDE: Record<
  OutcomeMilestone | "framework" | "finish",
  "framework" | "collect" | "write" | "finish"
> = {
  framework: "framework",
  evidence: "collect",
  chapter: "write",
  review: "write",
  shown: "write",
  finish: "finish",
};

function useMilestoneStatus() {
  const tr = useT().portfolioRoute;
  return (m: Milestone) =>
    m.complete ? tr.stepDone : fmt(tr.milestones[m.id].status, { done: m.done, total: m.total });
}

/**
 * The dossier's route (`dossierRoute`) in the shared `ProgressPanel`: the framework, each
 * learning outcome on its own, finishing. The next step leads into the outcome, at its next
 * milestone; every step is a way to go deeper.
 */
export function DossierProgress({
  dossierId,
  route,
  outcomes,
  practise,
}: {
  dossierId: string;
  route: ReturnType<typeof dossierRoute>;
  outcomes: Outcome[];
  /** The rehearsal assessment of this dossier (P29.3). */
  practise: string;
}) {
  const t = useT();
  const tr = t.portfolioRoute;
  const milestoneStatus = useMilestoneStatus();
  const base = `/portfolio/${dossierId}`;
  const label = (s: RouteStep) => {
    if (s.kind !== "outcome") return tr.steps[s.kind].title;
    const o = outcomes.find((x) => x.id === s.outcomeId);
    return o ? outcomeLabel(o) : "";
  };
  const href = (s: RouteStep) => {
    if (s.kind === "framework") return `${base}/framework`;
    if (s.kind === "finish") return dossierHref(dossierId, "finish", "readiness");
    const outcomeId = s.outcomeId ?? "";
    return s.milestone
      ? milestoneHref(dossierId, outcomeId, s.milestone.id)
      : outcomeHref(dossierId, outcomeId, "overview");
  };
  const status = (s: RouteStep) => {
    if (s.complete) return tr.stepDone;
    if (s.kind === "outcome") return s.milestone ? milestoneStatus(s.milestone) : tr.stepTodo;
    if (s.kind === "finish" && s.total > 0) return fmt(tr.steps.finish.status, { n: s.total });
    return s.kind === "framework" ? tr.steps.framework.status : tr.stepTodo;
  };
  const how = (s: RouteStep) =>
    s.kind === "outcome" ? tr.milestones[s.milestone?.id ?? "shown"].how : tr.steps[s.kind].how;
  const guide = (s: RouteStep | null) =>
    s ? GUIDE[s.kind === "outcome" ? (s.milestone?.id ?? "shown") : s.kind] : "finish";
  const { next } = route;
  return (
    <div className="mt-6">
      <ProgressPanel
        title={tr.title}
        intro={tr.intro}
        summary={fmt(tr.summary, { done: route.complete, total: route.total })}
        stepsLabel={tr.stepsLabel}
        steps={route.steps.map((s) => ({
          id: s.id,
          label: label(s),
          status: status(s),
          complete: s.complete,
          href: href(s),
        }))}
        next={
          next && {
            id: next.id,
            heading: fmt(tr.next, { step: label(next) }),
            how: how(next),
            cta: fmt(tr.goTo, { place: label(next) }),
            href: href(next),
          }
        }
        allDone={tr.allDone}
      />
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link
          to={`/help/bdb-bke#${tr.guideAnchors[guide(next)]}`}
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {tr.guide}
        </Link>
        {(!next || next.kind === "finish") && (
          <Link to={practise} className="font-medium text-violet-700 underline underline-offset-2">
            {tr.practise}
          </Link>
        )}
      </p>
    </div>
  );
}

/** One learning outcome's four milestones (`outcomeRoute`), each a link to its tab. */
export function OutcomeProgress({
  dossierId,
  outcomeId,
  milestones,
}: {
  dossierId: string;
  outcomeId: string;
  milestones: Milestone[];
}) {
  const tr = useT().portfolioRoute;
  const milestoneStatus = useMilestoneStatus();
  const next = milestones.find((m) => !m.complete) ?? null;
  const href = (m: Milestone) => milestoneHref(dossierId, outcomeId, m.id);
  return (
    <div className="mt-6">
      <ProgressPanel
        title={tr.outcomeTitle}
        intro={tr.outcomeIntro}
        summary={fmt(tr.summary, {
          done: milestones.filter((m) => m.complete).length,
          total: milestones.length,
        })}
        stepsLabel={tr.outcomeStepsLabel}
        steps={milestones.map((m) => ({
          id: m.id,
          label: tr.milestones[m.id].title,
          status: milestoneStatus(m),
          complete: m.complete,
          href: href(m),
        }))}
        next={
          next && {
            id: next.id,
            heading: fmt(tr.next, { step: tr.milestones[next.id].title }),
            how: tr.milestones[next.id].how,
            cta: fmt(tr.goTo, { place: tr.milestones[next.id].title }),
            href: href(next),
          }
        }
        allDone={tr.outcomeAllDone}
      />
    </div>
  );
}
