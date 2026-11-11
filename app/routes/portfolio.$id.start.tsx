import { Form, Link, useActionData, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.start";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { anchorCourses } from "~/server/dossierAnchors.server";
import { daysUntil } from "~/lib/portfolio/anchors";
import { dayPlan, isoDay } from "~/lib/portfolio/plan";
import { frameworkInUse } from "~/lib/portfolio/extract";
import { START_STEPS, startStep } from "~/lib/portfolio/start";
import { FrameworkExtract } from "~/components/portfolio/FrameworkExtract";
import { AnchorForm } from "~/components/portfolio/AnchorForm";
import { DayPlan } from "~/components/portfolio/DayPlan";
import {
  FrameworkSummary,
  PlanningStep,
  StartSteps,
  StepFooter,
  TrackStep,
} from "~/components/portfolio/StartWizard";
import { Button, Card } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.name ?? "BDB/BKE"} — LimeOnIt` }];
}

/**
 * The start wizard of a dossier (step 4 of the guided route): track, framework, an anchor per
 * learning outcome, and the hand-in date. Every step has its own address and may be skipped;
 * each form posts through the dossier's one save path.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  const step = startStep(new URL(request.url).searchParams.get("step"));
  const today = isoDay(Date.now());
  return {
    id: dossier.id,
    name: dossier.name,
    step,
    tracks: d.tracks,
    framework: d.framework,
    canExtract: !frameworkInUse(d),
    anchors: d.anchors ?? {},
    // The courses only where they are chosen.
    courses: step === "anchors" ? await anchorCourses(user.id) : [],
    deadline: d.deadline,
    daysLeft: d.deadline ? daysUntil(d.deadline, Date.now()) : undefined,
    hoursPerDay: d.hoursPerDay,
    // The plan only where it is made.
    plan: step === "planning" ? dayPlan(d, today) : null,
    today,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioStart({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const ts = t.portfolioStart;
  const tf = t.portfolio.framework;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) =>
      fd?.get("intent") === "extract"
        ? { variant: "pending", message: tf.extractPending }
        : { variant: "pending", message: t.toast.saving },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      if (r.intent === "extract")
        return {
          variant: "success",
          message: r.flagged ? fmt(tf.extractDoneCheck, { n: String(r.flagged) }) : tf.extractDone,
        };
      if (r.intent === "anchors")
        return {
          variant: "success",
          message: r.added ? fmt(ts.anchors.savedWithEvidence, { n: r.added }) : ts.anchors.saved,
        };
      if (r.intent === "confirm")
        return { variant: "success", message: t.portfolio.toastConfirmed };
      return { variant: "success", message: t.portfolio.toastSaved };
    },
  });
  const {
    id,
    name,
    tracks,
    framework,
    canExtract,
    anchors,
    courses,
    deadline,
    daysLeft,
    hoursPerDay,
    plan,
    today,
  } = loaderData;
  // The step follows the URL, so the links between steps work without a reload.
  const [params] = useSearchParams();
  const step = startStep(params.get("step"));
  const criteria = framework.outcomes.reduce((n, o) => n + o.criteria.length, 0);

  return (
    <div className="w-full min-w-0">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.portfolio.backToDossier}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {ts.heading} · {name}
      </h1>
      <p className="mt-2 text-slate-600">{ts.intro}</p>
      <StartSteps dossierId={id} current={step} />
      <p className="mt-4 text-sm font-medium text-slate-700">
        {fmt(ts.stepOf, { n: START_STEPS.indexOf(step) + 1, total: START_STEPS.length })}
      </p>

      {step === "track" && <TrackStep tracks={tracks} institution={framework.institution} />}

      {step === "framework" && (
        <>
          {framework.outcomes.length > 0 && (
            <FrameworkSummary
              dossierId={id}
              outcomes={framework.outcomes.length}
              criteria={criteria}
              confirmed={framework.confirmedAt !== undefined && !framework.provisional}
            />
          )}
          {canExtract && <FrameworkExtract replaces={framework.outcomes.length > 0} />}
          {framework.outcomes.length === 0 && (
            <Card className="mt-6 p-5">
              <h2 className="text-lg font-medium text-slate-900">{tf.skeletonTitle}</h2>
              <p className="mt-1 text-sm text-slate-600">{tf.skeletonBody}</p>
              <Form method="post" className="mt-3">
                <input type="hidden" name="intent" value="useSkeleton" />
                <Button type="submit" variant="secondary">
                  {tf.skeletonUse}
                </Button>
              </Form>
            </Card>
          )}
        </>
      )}

      {step === "anchors" && (
        <AnchorForm outcomes={framework.outcomes} anchors={anchors} courses={courses} />
      )}

      {step === "planning" && (
        <>
          <PlanningStep deadline={deadline} daysLeft={daysLeft} hoursPerDay={hoursPerDay} />
          {plan && (
            <DayPlan dossierId={id} plan={plan} outcomes={framework.outcomes} today={today} />
          )}
        </>
      )}

      <StepFooter dossierId={id} step={step} />
    </div>
  );
}
