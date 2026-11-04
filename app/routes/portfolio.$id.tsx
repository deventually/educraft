import { Form, Link, useActionData } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "./+types/portfolio.$id";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { nextStep, outcomeProgress, requirementFindings } from "~/lib/portfolio/progress";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import { Button, Card, Input, Label } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.name ?? "BDB/BKE"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  return {
    id: dossier.id,
    name: dossier.name,
    framework: d.framework,
    progress: outcomeProgress(d),
    findings: requirementFindings(d),
    next: nextStep(d),
    references: d.references,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioOverview({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (r) =>
      !r
        ? null
        : r.ok
          ? { variant: "success", message: t.portfolio.toastSaved }
          : { variant: "error", message: r.error },
  });
  const { id, name, framework, progress, findings, next, references } = loaderData;
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
    <div className="mx-auto max-w-4xl">
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
      </Card>

      <p className="mt-6 text-sm text-slate-600">
        {framework.confirmedAt
          ? fmt(t.portfolio.frameworkConfirmed, { date: fmtDate(framework.confirmedAt, locale) })
          : t.portfolio.frameworkNotConfirmed}{" "}
        <Link
          to={`/portfolio/${id}/framework`}
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {t.portfolio.frameworkLink}
        </Link>
      </p>

      {/* Word export (25.6): a plain download link, works without JS. */}
      <p className="mt-2">
        <a
          href={`/portfolio/${id}/export`}
          download
          className="text-sm font-medium text-violet-700 underline underline-offset-2"
        >
          {t.portfolio.exportWord}
        </a>
      </p>

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
              </li>
            ))}
          </ul>
        </section>
      )}

      {findings.length > 0 && (
        <section className="mt-8" aria-labelledby="findings-title">
          <h2 id="findings-title" className="text-lg font-medium text-slate-900">
            {t.portfolio.findingsTitle}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {findings.map((f) => (
              <li key={f.code === "over-word-limit" ? f.code : f.criterionId}>
                {f.code === "over-word-limit"
                  ? fmt(t.portfolio.findingOverWords, { words: f.words, limit: f.limit })
                  : fmt(t.portfolio.findingNoEvidence, {
                      outcome: labelOf(f.outcomeId),
                      criterion: criterionText(f.outcomeId, f.criterionId),
                    })}
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
