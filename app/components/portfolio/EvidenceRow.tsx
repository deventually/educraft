import { Form, Link } from "react-router";
import { Trash2 } from "lucide-react";
import { Button, Input, Label, Select } from "~/components/ui";
import { EvidenceTextField } from "~/components/portfolio/EvidenceTextField";
import { evidencePending } from "~/lib/portfolio/evidence";
import { fmtDate } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import { EVIDENCE_KINDS, type Criterion, type EvidenceItem } from "~/lib/portfolio/types";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

/** The fields of one evidence item: title, kind, text and the criteria it shows. */
export function EvidenceFields({
  prefix,
  criteria,
  item,
}: {
  prefix: string;
  criteria: Criterion[];
  item?: EvidenceItem;
}) {
  const t = useT().portfolio;
  const linked = new Set(item?.criterionIds ?? []);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div>
          <Label htmlFor={`${prefix}-title`}>{t.outcome.evidenceTitleLabel}</Label>
          <Input
            id={`${prefix}-title`}
            name="title"
            required
            maxLength={LIMITS.title}
            defaultValue={item?.title ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}-kind`}>{t.outcome.evidenceKind}</Label>
          <Select id={`${prefix}-kind`} name="kind" defaultValue={item?.kind ?? "other"}>
            {EVIDENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.kinds[k]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <EvidenceTextField id={`${prefix}-text`} defaultValue={item?.text ?? ""} />
      {criteria.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">
            {t.outcome.evidenceCriteria}
          </legend>
          <div className="mt-2 space-y-1">
            {criteria.map((c, i) => (
              <label key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="criterionIds"
                  value={c.id}
                  defaultChecked={linked.has(c.id)}
                  className="mt-1"
                />
                <span>
                  {i + 1}. {c.text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}

/** One evidence item: folded open to edit it, remove it or refresh its course snapshot. */
export function EvidenceRow({
  item,
  outcomeId,
  criteria,
  courses,
}: {
  item: EvidenceItem;
  outcomeId: string;
  criteria: Criterion[];
  /** courseId → name, or null when the course is gone (P26.4). */
  courses: Record<string, string | null>;
}) {
  const t = useT().portfolio;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <details>
        <summary className="cursor-pointer px-4 py-3">
          <span className="font-medium text-slate-900">{item.title}</span>{" "}
          <span className="text-sm text-slate-600">· {t.kinds[item.kind]}</span>
          {evidencePending(item) && (
            <>
              {" "}
              <span className="ml-1 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                {t.outcome.evidencePending}
              </span>
            </>
          )}
        </summary>
        <div className="border-t border-slate-100 p-4">
          {item.sourceCourse && (
            <CourseSnapshot
              evidenceId={item.id}
              source={item.sourceCourse}
              courseName={courses[item.sourceCourse.courseId] ?? null}
            />
          )}
          <Form method="post" className="grid gap-3">
            <input type="hidden" name="intent" value="updateEvidence" />
            <input type="hidden" name="outcomeId" value={outcomeId} />
            <input type="hidden" name="evidenceId" value={item.id} />
            <EvidenceFields prefix={`ev-${item.id}`} criteria={criteria} item={item} />
            <div>
              <Button type="submit" variant="secondary" size="sm">
                {t.outcome.saveEvidence}
              </Button>
            </div>
          </Form>
          <Form method="post" className="mt-2">
            <input type="hidden" name="intent" value="removeEvidence" />
            <input type="hidden" name="evidenceId" value={item.id} />
            <Button
              type="submit"
              variant="danger"
              size="sm"
              aria-label={`${t.outcome.removeEvidence}: ${item.title}`}
            >
              <Trash2 className="size-4" aria-hidden />
              {t.outcome.removeEvidence}
            </Button>
          </Form>
        </div>
      </details>
    </li>
  );
}

/** Where a snapshot comes from, with a way to the course and "Opnieuw ophalen" (P26.4). */
function CourseSnapshot({
  evidenceId,
  source,
  courseName,
}: {
  evidenceId: string;
  source: NonNullable<EvidenceItem["sourceCourse"]>;
  courseName: string | null;
}) {
  const t = useT().portfolio;
  const locale = useLocale();
  const date = fmtDate(source.at, locale);
  if (courseName === null)
    return <p className="mb-3 text-sm text-slate-600">{fmt(t.outcome.fromGoneCourse, { date })}</p>;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <p>{fmt(t.outcome.fromCourse, { course: courseName, date })}</p>
      <Link
        to={`/courses/${source.courseId}`}
        className="font-medium text-violet-700 underline underline-offset-2"
      >
        {t.outcome.openCourse}
      </Link>
      <Form method="post">
        <input type="hidden" name="intent" value="refreshCourseEvidence" />
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <Button type="submit" variant="secondary" size="sm">
          {t.outcome.refresh}
        </Button>
      </Form>
    </div>
  );
}
