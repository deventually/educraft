import { useId } from "react";
import { Form } from "react-router";
import { BLOOM_LEVELS, bloomLabel } from "~/lib/courses/bloom";
import { itemTotals } from "~/lib/courses/items";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import {
  type Assessment,
  type AssessmentItem,
  type CourseData,
  ITEM_FORMATS,
} from "~/lib/courses/types";
import { Button, Input, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { NumberField, useOutcomeName } from "./fields";

/** "1 vraag" / "3 vragen". */
export function useQuestionCount() {
  const t = useT();
  return (n: number) => (n === 1 ? t.courses.items.countOne : fmt(t.courses.items.count, { n }));
}

const cell = "px-2 py-1.5 align-top";

/**
 * The question-level matrix of one assessment (brief P26, 26.1): a real table,
 * one row per question, each row its own `<Form>` through the `form` attribute,
 * so it works without JavaScript. The total row gives each outcome's share.
 */
export function ItemsMatrix({ data, assessment }: { data: CourseData; assessment: Assessment }) {
  const t = useT();
  const m = t.courses.items;
  const outcomeName = useOutcomeName();
  const count = useQuestionCount();
  const items = assessment.items ?? [];
  const totals = itemTotals(assessment);
  const outcomeIndex = (outcomeId: string) => data.outcomes.findIndex((o) => o.id === outcomeId);
  const nameOf = (outcomeId: string) => outcomeName(outcomeIndex(outcomeId));
  const caption = fmt(m.caption, { assessment: assessment.title });

  return (
    <details className="mt-2 [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
        {fmt(m.summary, { n: items.length })}
        <span className="sr-only">: {assessment.title}</span>
      </summary>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">{m.empty}</p>
      ) : (
        <section
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
          tabIndex={0}
          aria-label={caption}
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-violet-600"
        >
          <table className="w-full border-collapse text-sm">
            <caption className="px-3 py-2 text-left text-slate-600">{caption}</caption>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-800">
                {[m.label, t.courses.outcomes.text, m.bloom, m.format, m.points].map((h) => (
                  <th key={h} scope="col" className={`${cell} font-medium`}>
                    {h}
                  </th>
                ))}
                <th scope="col" className={cell}>
                  <span className="sr-only">{m.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow key={item.id} data={data} assessmentId={assessment.id} item={item} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-slate-800">
                <th scope="row" className={`${cell} text-left font-medium`}>
                  {m.total}
                </th>
                <td colSpan={5} className={cell}>
                  {fmt(m.totalLine, { count: count(totals.count), points: totals.points })}
                  <span className="block text-slate-600">
                    {[...totals.byOutcome]
                      .sort((a, b) => outcomeIndex(a.outcomeId) - outcomeIndex(b.outcomeId))
                      .map((o) => `${nameOf(o.outcomeId)}: ${o.share}%`)
                      .join(" · ")}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
      <AddItemForm data={data} assessment={assessment} />
    </details>
  );
}

function OutcomeOptions({ data }: { data: CourseData }) {
  const outcomeName = useOutcomeName();
  return data.outcomes.map((o, i) => (
    <option key={o.id} value={o.id}>
      {`${outcomeName(i)} — ${o.text.length > 40 ? `${o.text.slice(0, 39)}…` : o.text}`}
    </option>
  ));
}

function BloomOptions() {
  const t = useT();
  const locale = useLocale();
  return (
    <>
      <option value="">{t.courses.bloomNone}</option>
      {BLOOM_LEVELS.map((level) => (
        <option key={level} value={level}>
          {bloomLabel(level, locale)}
        </option>
      ))}
    </>
  );
}

function FormatOptions() {
  const m = useT().courses.items;
  return (
    <>
      <option value="">{m.formatNone}</option>
      {ITEM_FORMATS.map((f) => (
        <option key={f} value={f}>
          {m.formats[f]}
        </option>
      ))}
    </>
  );
}

function ItemRow({
  data,
  assessmentId,
  item,
}: {
  data: CourseData;
  assessmentId: string;
  item: AssessmentItem;
}) {
  const t = useT();
  const m = t.courses.items;
  const formId = `item-${useId()}`;
  const of = (field: string) => fmt(m.fieldOf, { field, label: item.label });
  const question = fmt(m.question, { label: item.label });
  return (
    <tr className="border-b border-slate-100">
      <td className={cell}>
        <Input
          form={formId}
          name="label"
          required
          maxLength={COURSE_LIMITS.itemLabel}
          defaultValue={item.label}
          aria-label={of(m.label)}
          className="w-16"
        />
      </td>
      <td className={cell}>
        <Select
          form={formId}
          name="outcomeId"
          defaultValue={item.outcomeId}
          aria-label={of(t.courses.outcomes.text)}
          className="min-w-40"
        >
          <OutcomeOptions data={data} />
        </Select>
      </td>
      <td className={cell}>
        <Select
          form={formId}
          name="bloom"
          defaultValue={item.bloom ?? ""}
          aria-label={of(m.bloom)}
          className="min-w-32"
        >
          <BloomOptions />
        </Select>
      </td>
      <td className={cell}>
        <Select
          form={formId}
          name="format"
          defaultValue={item.format ?? ""}
          aria-label={of(m.format)}
          className="min-w-36"
        >
          <FormatOptions />
        </Select>
      </td>
      <td className={cell}>
        <Input
          form={formId}
          name="points"
          inputMode="decimal"
          defaultValue={item.points ?? ""}
          aria-label={of(m.points)}
          className="w-20"
        />
      </td>
      <td className={`${cell} whitespace-nowrap`}>
        <Form method="post" id={formId} className="inline">
          <input type="hidden" name="intent" value="update-item" />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" size="sm" variant="secondary">
            {t.courses.save}
            <span className="sr-only">: {question}</span>
          </Button>
        </Form>{" "}
        <Form method="post" className="inline">
          <input type="hidden" name="intent" value="remove-item" />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="id" value={item.id} />
          <Button type="submit" size="sm" variant="ghost">
            {t.courses.remove}
            <span className="sr-only">: {question}</span>
          </Button>
        </Form>
      </td>
    </tr>
  );
}

function AddItemForm({ data, assessment }: { data: CourseData; assessment: Assessment }) {
  const t = useT();
  const m = t.courses.items;
  const id = useId();
  if (data.outcomes.length === 0)
    return <p className="mt-3 text-sm text-slate-600">{t.courses.noOutcomesYet}</p>;
  return (
    <Form method="post" className="mt-3 space-y-3">
      <input type="hidden" name="intent" value="add-item" />
      <input type="hidden" name="assessmentId" value={assessment.id} />
      <p className="text-sm font-medium text-slate-800">{m.addTitle}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_1fr_1fr_1fr]">
        <div>
          <Label htmlFor={`${id}-label`}>{m.label}</Label>
          <Input
            id={`${id}-label`}
            name="label"
            maxLength={COURSE_LIMITS.itemLabel}
            aria-describedby={`${id}-label-hint`}
            className="mt-1"
          />
          <p id={`${id}-label-hint`} className="mt-1 text-xs text-slate-500">
            {m.labelHint}
          </p>
        </div>
        <div>
          <Label htmlFor={`${id}-outcome`}>{t.courses.outcomes.text}</Label>
          <Select id={`${id}-outcome`} name="outcomeId" required className="mt-1">
            <OutcomeOptions data={data} />
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-bloom`}>{m.bloom}</Label>
          <Select id={`${id}-bloom`} name="bloom" defaultValue="" className="mt-1">
            <BloomOptions />
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-format`}>{m.format}</Label>
          <Select id={`${id}-format`} name="format" defaultValue="" className="mt-1">
            <FormatOptions />
          </Select>
        </div>
        <NumberField id={`${id}-points`} name="points" label={m.points} />
      </div>
      <Button type="submit" size="sm">
        {m.add}
        <span className="sr-only">: {assessment.title}</span>
      </Button>
    </Form>
  );
}
