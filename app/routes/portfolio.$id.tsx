import { Form, Link, useActionData } from "react-router";
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
import { dossierStep } from "~/lib/portfolio/step";
import { DossierRoute } from "~/components/portfolio/DossierRoute";
import { ReadinessCheck, ReadinessSummaryLink } from "~/components/portfolio/ReadinessCheck";
import { DossierReviewPanel } from "~/components/portfolio/DossierReviewPanel";
import { readinessCheck } from "~/lib/portfolio/readiness";
import { openSpots } from "~/lib/portfolio/openSpots";
import { dossierPart } from "~/lib/portfolio/dossierPart";
import { nextStep, outcomeProgress } from "~/lib/portfolio/progress";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Card, Input, Label } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.name ?? "BDB/BKE"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  const next = nextStep(d);
  const names = await availableToolNames(request, user);
  let nextTools: { slug: string; name: string }[] = [];
  if (next.step === "add-evidence") {
    const outcome = d.framework.outcomes.find((o) => o.id === next.outcomeId);
    const criterion = outcome?.criteria.find((c) => c.id === next.criterionId);
    if (outcome && criterion) {
      nextTools = criterionHints(outcome, criterion, new Set(names.keys())).map((slug) => ({
        slug,
        name: names.get(slug) ?? slug,
      }));
    }
  }
  // The five-step route: each step links to where you do it.
  const base = `/portfolio/${dossier.id}`;
  const outcomeId = "outcomeId" in next ? next.outcomeId : d.framework.outcomes[0]?.id;
  const work = outcomeId ? `${base}/outcome/${outcomeId}` : `${base}/framework`;
  const routeLinks = {
    framework: `${base}/framework`,
    collect: work,
    fill: work,
    write: work,
    finish: "#readiness",
  };
  // Step 5: practise the final interview with the rehearsal of this dossier (P29.3).
  const practise = `${base}/rehearsal`;
  return {
    id: dossier.id,
    name: dossier.name,
    framework: d.framework,
    progress: outcomeProgress(d),
    next,
    nextTools,
    step: dossierStep(d),
    routeLinks,
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
    next,
    references,
    coachMode,
    aiUsed,
    aiRequired,
    nextTools,
    step: routeStep,
    routeLinks,
    practise,
    readiness,
    dossierReview,
    canReviewAll,
    openSpots: open,
    partOpenSpots,
  } = loaderData;
  const outcomes = new Map(framework.outcomes.map((o) => [o.id, o]));
  const labelOf = (outcomeId: string) => {
    const o = outcomes.get(outcomeId);
    return o ? outcomeLabel(o) : "";
  };
  const criterionText = (outcomeId: string, criterionId: string) =>
    outcomes.get(outcomeId)?.criteria.find((c) => c.id === criterionId)?.text ?? "";

  const step = (() => {
    const ns = t.portfolio.nextStep;
    switch (next.step) {
      case "build-framework":
        return { text: ns.buildFramework, to: `/portfolio/${id}/framework` };
      case "confirm-framework":
        return { text: ns.confirmFramework, to: `/portfolio/${id}/framework` };
      case "add-evidence":
        return {
          text: fmt(ns.addEvidence, { outcome: labelOf(next.outcomeId) }),
          to: `/portfolio/${id}/outcome/${next.outcomeId}`,
        };
      case "write-chapter":
        return {
          text: fmt(ns.writeChapter, { outcome: labelOf(next.outcomeId) }),
          to: `/portfolio/${id}/outcome/${next.outcomeId}`,
        };
      case "mark-shown":
        return {
          text: fmt(ns.markShown, { outcome: labelOf(next.outcomeId) }),
          to: `/portfolio/${id}/outcome/${next.outcomeId}`,
        };
      default:
        return { text: ns.done, to: null };
    }
  })();

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

      <DossierRoute current={routeStep} links={routeLinks} practise={practise} />

      <Card className="mt-6 border-violet-200 bg-violet-50 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-violet-800">
          {t.portfolio.nextStepTitle}
        </h2>
        <p className="mt-1 text-slate-900">{step.text}</p>
        {step.to && (
          <Link
            to={step.to}
            className="mt-2 inline-block text-sm font-medium text-violet-700 underline underline-offset-2"
          >
            {t.portfolio.goThere}
          </Link>
        )}
        <ToolHints
          hints={nextTools}
          step="evidence"
          from={
            next.step === "add-evidence"
              ? { dossierId: id, criterionId: next.criterionId }
              : undefined
          }
          className="mt-3 bg-white"
        />
      </Card>

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
        </Link>
      </p>

      {/* Step 5: assess the whole dossier, check it, then export. */}
      <DossierReviewPanel
        dossierId={id}
        outcomes={framework.outcomes}
        rows={dossierReview}
        canRun={canReviewAll}
      />

      <ReadinessCheck dossierId={id} items={readiness} framework={framework} />

      {/* Word export (25.6): a plain GET form, works without JS. */}
      <form
        id="export"
        method="get"
        action={`/portfolio/${id}/export`}
        className="mt-4 flex flex-wrap items-center gap-3"
        aria-label={t.portfolio.exportTitle}
      >
        <ReadinessSummaryLink items={readiness} />
        {aiUsed && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="ai" value="1" defaultChecked={aiRequired} />
            {t.portfolio.exportAi}
          </label>
        )}
        {open > 0 ? (
          <>
            {/* An open spot never reaches the handed-in work (BESLUIT-2026-11-07-4). */}
            <p className="w-full text-sm text-slate-800">
              {fmt(open === 1 ? t.portfolio.exportBlocked : t.portfolio.exportBlockedMany, {
                n: open,
              })}{" "}
              <a
                href="#readiness"
                className="font-medium text-violet-700 underline underline-offset-2"
              >
                {t.portfolio.exportBlockedLink}
              </a>
            </p>
            <Button
              type="submit"
              name="draft"
              value="1"
              variant="secondary"
              size="sm"
              aria-describedby="export-draft-help"
            >
              {t.portfolio.exportDraftWord}
            </Button>
            <Button
              type="submit"
              name="draft"
              value="1"
              formAction={`/portfolio/${id}/print`}
              formTarget="_blank"
              variant="secondary"
              size="sm"
              aria-describedby="export-draft-help"
            >
              {t.portfolio.exportDraftPdf}
            </Button>
            <p id="export-draft-help" className="w-full text-sm text-slate-600">
              {t.portfolio.exportDraftHelp}
            </p>
          </>
        ) : (
          <>
            <Button type="submit" variant="secondary" size="sm">
              {t.portfolio.exportWord}
            </Button>
            <Button
              type="submit"
              formAction={`/portfolio/${id}/print`}
              formTarget="_blank"
              variant="secondary"
              size="sm"
            >
              {t.portfolio.exportPdf}
            </Button>
          </>
        )}
        {aiUsed && aiRequired && (
          <p className="w-full text-sm text-slate-600">{t.portfolio.exportAiRequired}</p>
        )}
      </form>

      <Form method="post" className="mt-6">
        <input type="hidden" name="intent" value="coachMode" />
        <fieldset>
          <legend className="text-sm font-medium text-slate-900">{t.portfolio.mode.legend}</legend>
          <div className="mt-2 space-y-1">
            {(["coach", "draft"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name="mode" value={mode} defaultChecked={coachMode === mode} />
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
    </div>
  );
}

/**
 * One learning outcome handed in on its own (Word or PDF). While it has an open spot
 * the links give the draft version, and say so (BESLUIT-2026-11-07-4).
 */
function PartExport({
  dossierId,
  outcomeId,
  label,
  open,
  ai,
}: {
  dossierId: string;
  outcomeId: string;
  label: string;
  open: number;
  /** The form asks for the AI disclosure and AI was used: always include it. */
  ai: boolean;
}) {
  const t = useT().portfolio.part;
  const query = `?lu=${encodeURIComponent(outcomeId)}${open > 0 ? "&draft=1" : ""}${ai ? "&ai=1" : ""}`;
  const link = "font-medium text-violet-700 underline underline-offset-2";
  return (
    <fieldset className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <legend className="sr-only">{fmt(t.label, { outcome: label })}</legend>
      <span className={open > 0 ? "font-medium text-amber-800" : "text-slate-700"}>
        {open > 0 ? fmt(open === 1 ? t.draftOne : t.draft, { n: open }) : t.final}
      </span>
      <a href={`/portfolio/${dossierId}/export${query}`} className={link}>
        {open > 0 ? t.wordDraft : t.word}
      </a>
      <a
        href={`/portfolio/${dossierId}/print${query}`}
        target="_blank"
        rel="noopener"
        className={link}
      >
        {open > 0 ? t.pdfDraft : t.pdf}
      </a>
    </fieldset>
  );
}
