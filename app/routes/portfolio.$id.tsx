import { Form, Link, useActionData, useSearchParams } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "./+types/portfolio.$id";
import {
  availableToolNames,
  dossierReviewOverview,
  loadDossier,
  saveIntent,
} from "~/server/portfolio.server";
import { criterionHints } from "~/lib/portfolio/toolHints";
import { ToolHints } from "~/components/portfolio/ToolHints";
import { WordImport } from "~/components/portfolio/WordImport";
import { dossierRoute } from "~/lib/portfolio/route";
import { DossierProgress } from "~/components/portfolio/DossierProgress";
import { TabNav } from "~/components/TabNav";
import { DOSSIER_TABS, dossierHref, dossierTab } from "~/lib/portfolio/tabs";
import { ReadinessCheck } from "~/components/portfolio/ReadinessCheck";
import { DossierExport, PartExport } from "~/components/portfolio/DossierExport";
import { DossierReviewPanel } from "~/components/portfolio/DossierReviewPanel";
import { readinessCheck } from "~/lib/portfolio/readiness";
import { openSpots } from "~/lib/portfolio/openSpots";
import { dossierPart } from "~/lib/portfolio/dossierPart";
import { outcomeProgress } from "~/lib/portfolio/progress";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Input, Label } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { anchorToolQuery, daysUntil } from "~/lib/portfolio/anchors";
import { startHref } from "~/lib/portfolio/start";
import { DeadlineNote } from "~/components/portfolio/StartWizard";
import { DayPlan, useHours } from "~/components/portfolio/DayPlan";
import { dayPlan, isoDay } from "~/lib/portfolio/plan";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.name ?? "BDB/BKE"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  const route = dossierRoute(d);
  // The next criterion without evidence, when that is the next step: the tools that help with it.
  const nextCriterion =
    route.next?.milestone?.id === "evidence" ? route.next.milestone.criterionId : undefined;
  const names = await availableToolNames(request, user);
  let nextTools: { slug: string; name: string }[] = [];
  if (nextCriterion) {
    const outcome = d.framework.outcomes.find((o) => o.id === route.next?.outcomeId);
    const criterion = outcome?.criteria.find((c) => c.id === nextCriterion);
    if (outcome && criterion) {
      nextTools = criterionHints(outcome, criterion, new Set(names.keys())).map((slug) => ({
        slug,
        name: names.get(slug) ?? slug,
      }));
    }
  }
  // Finishing: practise the final interview with the rehearsal of this dossier (P29.3).
  const practise = `/portfolio/${dossier.id}/rehearsal`;
  const today = isoDay(Date.now());
  return {
    id: dossier.id,
    name: dossier.name,
    framework: d.framework,
    progress: outcomeProgress(d),
    route,
    nextTools,
    nextCriterion,
    // The next outcome's anchor: its tools open on that lesson, module or test.
    nextAnchor: anchorToolQuery(
      route.next?.outcomeId ? d.anchors?.[route.next.outcomeId] : undefined,
    ),
    deadline: d.deadline,
    daysLeft: d.deadline ? daysUntil(d.deadline, Date.now()) : undefined,
    plan: dayPlan(d, today),
    today,
    practise,
    readiness: readinessCheck(d),
    dossierReview: dossierReviewOverview(d),
    canReviewAll:
      d.framework.confirmedAt !== undefined && d.chapters.some((ch) => ch.text.trim() !== ""),
    openSpots: openSpots(d).length,
    // Each outcome handed in on its own: its open spots decide final or draft.
    partOpenSpots: Object.fromEntries(
      d.framework.outcomes.map((o) => {
        const part = dossierPart(d, o.id);
        return [o.id, part ? openSpots(part).length : 0];
      }),
    ),
    references: d.references,
    // Back from Word compares the file with these, in the browser.
    chapters: d.chapters.map(({ outcomeId, text }) => ({ outcomeId, text })),
    coachMode: d.coachMode,
    aiUsed: d.aiLog.length > 0,
    aiRequired: !!d.framework.requirements.aiDisclosureRequired,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioOverview({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const hours = useHours();
  const tr = t.portfolio.dossierReview;
  useFormToast(actionData, {
    pending: (fd) =>
      fd?.get("intent") === "reviewAll"
        ? { variant: "pending", message: tr.pending }
        : { variant: "pending", message: t.toast.saving },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      if (r.intent !== "reviewAll") return { variant: "success", message: t.portfolio.toastSaved };
      return r.failed
        ? {
            variant: "error",
            message: fmt(tr.doneWithFailures, { n: r.reviewed ?? 0, failed: r.failed }),
          }
        : { variant: "success", message: fmt(tr.done, { n: r.reviewed ?? 0 }) };
    },
  });
  const {
    id,
    name,
    framework,
    progress,
    route,
    references,
    chapters,
    coachMode,
    aiUsed,
    aiRequired,
    nextTools,
    nextCriterion,
    practise,
    readiness,
    dossierReview,
    canReviewAll,
    openSpots: open,
    partOpenSpots,
    nextAnchor = {},
    deadline,
    daysLeft,
    plan,
    today,
  } = loaderData;
  const outcomeMinutes = new Map(plan.items.map((i) => [i.outcomeId, i.minutes]));
  const [params] = useSearchParams();
  const tab = dossierTab(params.get("tab"));
  const outcomes = new Map(framework.outcomes.map((o) => [o.id, o]));
  const labelOf = (outcomeId: string) => {
    const o = outcomes.get(outcomeId);
    return o ? outcomeLabel(o) : "";
  };
  return (
    <div className="w-full min-w-0">
      <Link
        to="/portfolio"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.portfolio.backToList}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {name}
      </h1>

      <div className="mt-6">
        <TabNav
          label={t.portfolioRoute.tabs.dossierLabel}
          current={tab}
          tabs={DOSSIER_TABS.map((x) => ({
            id: x,
            label: t.portfolioRoute.tabs[x],
            href: dossierHref(id, x),
          }))}
        />
      </div>

      {tab === "overview" && (
        <>
          <DossierProgress
            dossierId={id}
            route={route}
            outcomes={framework.outcomes}
            practise={practise}
          />
          {nextCriterion && (
            <ToolHints
              hints={nextTools}
              step="evidence"
              from={{ dossierId: id, criterionId: nextCriterion }}
              anchor={nextAnchor}
              className="mt-3"
            />
          )}

          <p className="mt-6 text-sm text-slate-600">
            {framework.confirmedAt
              ? fmt(
                  framework.provisional
                    ? t.portfolio.frameworkProvisional
                    : t.portfolio.frameworkConfirmed,
                  { date: fmtDate(framework.confirmedAt, locale) },
                )
              : t.portfolio.frameworkNotConfirmed}{" "}
            <Link
              to={`/portfolio/${id}/framework`}
              className="font-medium text-violet-700 underline underline-offset-2"
            >
              {t.portfolio.frameworkLink}
            </Link>{" "}
            ·{" "}
            <Link
              to={startHref(id, "track")}
              className="font-medium text-violet-700 underline underline-offset-2"
            >
              {t.portfolioStart.open}
            </Link>
          </p>
          {deadline && daysLeft !== undefined && (
            <DeadlineNote deadline={deadline} daysLeft={daysLeft} className="mt-2" />
          )}

          <DayPlan dossierId={id} plan={plan} outcomes={framework.outcomes} today={today} />

          <Form method="post" className="mt-6">
            <input type="hidden" name="intent" value="coachMode" />
            <fieldset>
              <legend className="text-sm font-medium text-slate-900">
                {t.portfolio.mode.legend}
              </legend>
              <div className="mt-2 space-y-1">
                {(["coach", "draft"] as const).map((mode) => (
                  <label key={mode} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="mode"
                      value={mode}
                      defaultChecked={coachMode === mode}
                    />
                    {t.portfolio.mode[mode]}
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" variant="secondary" size="sm" className="mt-2">
              {t.portfolio.mode.save}
            </Button>
          </Form>

          {framework.outcomes.length > 0 && (
            <section className="mt-8" aria-labelledby="outcomes-title">
              <h2 id="outcomes-title" className="text-lg font-medium text-slate-900">
                {t.portfolio.outcomesTitle}
              </h2>
              <ul className="mt-3 space-y-3">
                {progress.map((p) => (
                  <li
                    key={p.outcomeId}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <Link
                      to={`/portfolio/${id}/outcome/${p.outcomeId}`}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {labelOf(p.outcomeId)}
                    </Link>
                    <p className="text-sm text-slate-700">
                      {fmt(t.portfolio.progressSummary, { shown: p.shown, total: p.criteria })} ·{" "}
                      {fmt(t.portfolio.words, { n: p.words })}
                      {outcomeMinutes.has(p.outcomeId) && (
                        <>
                          {" · "}
                          {fmt(t.portfolioPlan.outcomeLeft, {
                            time: hours(outcomeMinutes.get(p.outcomeId) ?? 0),
                          })}
                        </>
                      )}
                    </p>
                    {p.missingEvidence.length > 0 && (
                      <p className="text-sm text-slate-600">
                        {fmt(t.portfolio.missingEvidence, { items: p.missingEvidence.join("; ") })}
                      </p>
                    )}
                    <PartExport
                      dossierId={id}
                      outcomeId={p.outcomeId}
                      label={labelOf(p.outcomeId)}
                      open={partOpenSpots[p.outcomeId] ?? 0}
                      ai={aiUsed && aiRequired}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === "finish" && (
        <>
          {/* Finishing: assess the whole dossier, check it, export, and the references. */}
          <DossierReviewPanel
            dossierId={id}
            outcomes={framework.outcomes}
            rows={dossierReview}
            canRun={canReviewAll}
          />

          <ReadinessCheck dossierId={id} items={readiness} framework={framework} />

          <DossierExport
            dossierId={id}
            readiness={readiness}
            open={open}
            aiUsed={aiUsed}
            aiRequired={aiRequired}
          />

          {framework.outcomes.length > 0 && (
            <WordImport outcomes={framework.outcomes} chapters={chapters} references={references} />
          )}

          <section className="mt-8" aria-labelledby="references-title">
            <h2 id="references-title" className="text-lg font-medium text-slate-900">
              {t.portfolio.referencesTitle}
            </h2>
            {references.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{t.portfolio.referencesEmpty}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {references.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="text-slate-800">{r.apa}</span>
                    <Form method="post">
                      <input type="hidden" name="intent" value="removeReference" />
                      <input type="hidden" name="referenceId" value={r.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label={`${t.portfolio.referenceRemove}: ${r.apa}`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </Form>
                  </li>
                ))}
              </ul>
            )}
            <Form method="post" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="intent" value="addReference" />
              <div className="flex-1">
                <Label htmlFor="reference-apa">{t.portfolio.referenceLabel}</Label>
                <Input id="reference-apa" name="apa" required maxLength={LIMITS.reference} />
              </div>
              <Button type="submit" variant="secondary">
                {t.portfolio.referenceAdd}
              </Button>
            </Form>
          </section>
        </>
      )}
    </div>
  );
}
