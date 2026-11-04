import { useId } from "react";
import { Link, redirect } from "react-router";
import { ArrowLeft, Plus, Table2 } from "lucide-react";
import type { Route } from "./+types/utilities.rubric._index";
import { requireUser } from "~/server/auth.server";
import { createRubric, listRubrics } from "~/server/repositories/rubrics.server";
import { maxPoints, newRubricData, RUBRIC_LIMITS } from "~/lib/utilities/rubric";
import { getUtilityBySlug } from "~/lib/utilities";
import { EmptyState } from "~/components/EmptyState";
import { Input, Label } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { getLocale } from "~/lib/i18n/locale.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { formatNumber } from "~/components/utilities/format";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const rubrics = (await listRubrics(user.id)).map((r) => ({
    id: r.id,
    name: r.name,
    criteria: r.data.criteria.length,
    maxPoints: maxPoints(r.data),
    updatedAt: r.updatedAt.toISOString(),
  }));
  return { rubrics };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  if (fd.get("intent") !== "create") return { error: "invalid" as const };
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 1 || name.length > RUBRIC_LIMITS.name) return { error: "name" as const };
  // A new rubric starts in the teacher's UI language: one criterion, three levels.
  const r = getMessages(getLocale(request)).utilities.rubric;
  const rubric = await createRubric(
    user.id,
    name,
    newRubricData(r.defaultCriterion, [
      { label: r.defaultLevels.fail, points: 0 },
      { label: r.defaultLevels.pass, points: 1 },
      { label: r.defaultLevels.good, points: 2 },
    ]),
  );
  return redirect(`/utilities/rubric/${rubric.id}`);
}

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const utility = getUtilityBySlug("rubric");
  return [{ title: `${loc(utility?.name, root?.locale ?? DEFAULT_LOCALE)} — LimeOnIt` }];
}

/** The teacher's own rubrics (P23.2). */
export default function RubricList({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const r = t.utilities.rubric;
  const locale = useLocale();
  const utility = getUtilityBySlug("rubric");
  const { rubrics } = loaderData;
  const dateFmt = new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "medium",
  });

  return (
    <div>
      <Link
        to="/utilities"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.utilities.back}
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
            {loc(utility?.name, locale)}
          </h1>
          <p className="mt-3 max-w-[60ch] text-pretty text-slate-600">{r.listIntro}</p>
        </div>
        {rubrics.length > 0 && <NewRubricDialog />}
      </div>

      {rubrics.length === 0 ? (
        <EmptyState
          icon={<Table2 aria-hidden />}
          title={r.emptyTitle}
          body={r.emptyBody}
          action={{ node: <NewRubricDialog /> }}
        />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {rubrics.map((rubric) => (
            <li key={rubric.id}>
              <Link
                to={`/utilities/rubric/${rubric.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-violet-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-semibold text-slate-900">{rubric.name}</span>
                <span className="text-sm text-slate-600">
                  {fmt(r.summary, {
                    criteria: rubric.criteria,
                    points: formatNumber(rubric.maxPoints, locale),
                  })}
                  {" · "}
                  {fmt(r.updated, { date: dateFmt.format(new Date(rubric.updatedAt)) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Nieuwe rubric": asks for the name first, then creates the rubric and opens it. */
function NewRubricDialog() {
  const t = useT();
  const r = t.utilities.rubric;
  const id = useId();
  return (
    <ConfirmDialog
      triggerLabel={r.new}
      triggerIcon={<Plus className="size-4" aria-hidden />}
      triggerVariant="primary"
      triggerSize="md"
      title={r.newTitle}
      description={r.newBody}
      confirmLabel={r.create}
      confirmVariant="primary"
      cancelLabel={t.confirm.cancel}
      fields={{ intent: "create" }}
    >
      <div className="mt-4">
        <Label htmlFor={`${id}-name`}>{r.name}</Label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={RUBRIC_LIMITS.name}
          autoComplete="off"
          data-autofocus
          className="mt-1"
        />
      </div>
    </ConfirmDialog>
  );
}
