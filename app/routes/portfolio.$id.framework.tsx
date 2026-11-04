import { Form, Link, useActionData } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.framework";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { fmtDate, outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import type { Criterion, Outcome } from "~/lib/portfolio/types";
import { Button, Card, Input, Label, Textarea } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `${data?.name ?? "BDB/BKE"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { dossier } = await loadDossier(request, params.id);
  return { id: dossier.id, name: dossier.name, framework: dossier.data.framework };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioFramework({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const tf = t.portfolio.framework;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (r) =>
      !r
        ? null
        : r.ok
          ? {
              variant: "success",
              message: r.intent === "confirm" ? t.portfolio.toastConfirmed : t.portfolio.toastSaved,
            }
          : { variant: "error", message: r.error },
  });
  const { id, name, framework } = loaderData;
  const req = framework.requirements;
  const hasCriteria = framework.outcomes.some((o) => o.criteria.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.portfolio.backToDossier}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {tf.heading} · {name}
      </h1>
      <p className="mt-2 text-slate-600">{tf.intro}</p>

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-medium text-slate-900">{tf.metaTitle}</h2>
        <Form method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="intent" value="meta" />
          <div>
            <Label htmlFor="fw-institution">{tf.institution}</Label>
            <Input
              id="fw-institution"
              name="institution"
              defaultValue={framework.institution}
              maxLength={LIMITS.name}
            />
          </div>
          <div>
            <Label htmlFor="fw-year">{tf.year}</Label>
            <Input id="fw-year" name="year" defaultValue={framework.year ?? ""} maxLength={20} />
          </div>
          <div>
            <Label htmlFor="fw-maxWords">{tf.maxWords}</Label>
            <Input
              id="fw-maxWords"
              name="maxWords"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={req.maxWords ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="fw-minConstructed">{tf.minConstructedItems}</Label>
            <Input
              id="fw-minConstructed"
              name="minConstructedItems"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={req.minConstructedItems ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="fw-minAnalysed">{tf.minAnalysedItems}</Label>
            <Input
              id="fw-minAnalysed"
              name="minAnalysedItems"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={req.minAnalysedItems ?? ""}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm text-slate-700">
            <input
              type="checkbox"
              name="aiDisclosureRequired"
              defaultChecked={!!req.aiDisclosureRequired}
            />
            {tf.aiDisclosureRequired}
          </label>
          <div className="sm:col-span-2">
            <Label htmlFor="fw-notes">{tf.notes}</Label>
            <Textarea
              id="fw-notes"
              name="notes"
              rows={3}
              defaultValue={req.notes ?? ""}
              maxLength={LIMITS.notes}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">{tf.saveMeta}</Button>
          </div>
        </Form>
      </Card>

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

      {framework.outcomes.map((o) => (
        <OutcomeEditor key={o.id} outcome={o} tf={tf} />
      ))}

      {framework.outcomes.length < LIMITS.outcomes && (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-medium text-slate-900">{tf.addOutcomeTitle}</h2>
          <Form method="post" className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
            <input type="hidden" name="intent" value="addOutcome" />
            <div>
              <Label htmlFor="new-outcome-code">{tf.outcomeCode}</Label>
              <Input id="new-outcome-code" name="code" maxLength={LIMITS.code} />
            </div>
            <div>
              <Label htmlFor="new-outcome-title">{tf.outcomeTitle}</Label>
              <Input id="new-outcome-title" name="title" required maxLength={LIMITS.title} />
            </div>
            <Button type="submit" variant="secondary">
              {tf.addOutcome}
            </Button>
          </Form>
        </Card>
      )}

      <Card className="mt-6 p-5">
        <h2 className="text-lg font-medium text-slate-900">{tf.confirmTitle}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {framework.confirmedAt
            ? fmt(t.portfolio.frameworkConfirmed, { date: fmtDate(framework.confirmedAt, locale) })
            : tf.confirmBody}
        </p>
        {!framework.confirmedAt && (
          <Form method="post" className="mt-3">
            <input type="hidden" name="intent" value="confirm" />
            <Button type="submit" disabled={!hasCriteria}>
              {tf.confirm}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}

type FrameworkMessages = Messages["portfolio"]["framework"];

function OutcomeEditor({ outcome, tf }: { outcome: Outcome; tf: FrameworkMessages }) {
  const p = `o-${outcome.id}`;
  const label = outcomeLabel(outcome);
  return (
    <section
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby={`${p}-h`}
    >
      <h2 id={`${p}-h`} className="text-lg font-medium text-slate-900">
        {label}
      </h2>
      <Form method="post" className="mt-3 grid gap-3 sm:grid-cols-[8rem_1fr]">
        <input type="hidden" name="intent" value="updateOutcome" />
        <input type="hidden" name="outcomeId" value={outcome.id} />
        <div>
          <Label htmlFor={`${p}-code`}>{tf.outcomeCode}</Label>
          <Input id={`${p}-code`} name="code" defaultValue={outcome.code} maxLength={LIMITS.code} />
        </div>
        <div>
          <Label htmlFor={`${p}-title`}>{tf.outcomeTitle}</Label>
          <Input
            id={`${p}-title`}
            name="title"
            required
            defaultValue={outcome.title}
            maxLength={LIMITS.title}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor={`${p}-evidence`}>{tf.requiredEvidence}</Label>
          <Textarea
            id={`${p}-evidence`}
            name="requiredEvidence"
            rows={3}
            defaultValue={outcome.requiredEvidence.join("\n")}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="secondary" size="sm">
            {tf.saveOutcome}
          </Button>
        </div>
      </Form>
      <Form method="post" className="mt-2">
        <input type="hidden" name="intent" value="removeOutcome" />
        <input type="hidden" name="outcomeId" value={outcome.id} />
        <Button
          type="submit"
          variant="danger"
          size="sm"
          aria-label={`${tf.removeOutcome}: ${label}`}
        >
          <Trash2 className="size-4" aria-hidden />
          {tf.removeOutcome}
        </Button>
      </Form>

      <h3 className="mt-5 text-sm font-medium text-slate-900">{tf.criteriaTitle}</h3>
      <ol className="mt-2 space-y-3">
        {outcome.criteria.map((c, i) => (
          <CriterionEditor key={c.id} criterion={c} n={i + 1} tf={tf} />
        ))}
      </ol>
      {outcome.criteria.length < LIMITS.criteriaPerOutcome && (
        <Form method="post" className="mt-3 grid gap-2">
          <input type="hidden" name="intent" value="addCriterion" />
          <input type="hidden" name="outcomeId" value={outcome.id} />
          <div>
            <Label htmlFor={`${p}-new-c`}>{tf.criterionText}</Label>
            <Textarea
              id={`${p}-new-c`}
              name="text"
              rows={2}
              required
              maxLength={LIMITS.criterionText}
            />
          </div>
          <div>
            <Label htmlFor={`${p}-new-s`}>{tf.criterionStrong}</Label>
            <Input id={`${p}-new-s`} name="strongLevel" maxLength={LIMITS.criterionText} />
          </div>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              {tf.addCriterion}
            </Button>
          </div>
        </Form>
      )}
    </section>
  );
}

function CriterionEditor({
  criterion,
  n,
  tf,
}: {
  criterion: Criterion;
  n: number;
  tf: FrameworkMessages;
}) {
  const p = `c-${criterion.id}`;
  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <Form method="post" className="grid gap-2">
        <input type="hidden" name="intent" value="updateCriterion" />
        <input type="hidden" name="criterionId" value={criterion.id} />
        <div>
          <Label htmlFor={`${p}-text`}>
            {tf.criterionText} {n}
          </Label>
          <Textarea
            id={`${p}-text`}
            name="text"
            rows={2}
            required
            defaultValue={criterion.text}
            maxLength={LIMITS.criterionText}
          />
        </div>
        <div>
          <Label htmlFor={`${p}-strong`}>{tf.criterionStrong}</Label>
          <Input
            id={`${p}-strong`}
            name="strongLevel"
            defaultValue={criterion.strongLevel ?? ""}
            maxLength={LIMITS.criterionText}
          />
        </div>
        <div>
          <Button type="submit" variant="secondary" size="sm">
            {tf.saveCriterion}
          </Button>
        </div>
      </Form>
      <Form method="post" className="mt-2">
        <input type="hidden" name="intent" value="removeCriterion" />
        <input type="hidden" name="criterionId" value={criterion.id} />
        <Button type="submit" variant="ghost" size="sm" aria-label={`${tf.removeCriterion} ${n}`}>
          <Trash2 className="size-4" aria-hidden />
          {tf.removeCriterion}
        </Button>
      </Form>
    </li>
  );
}
