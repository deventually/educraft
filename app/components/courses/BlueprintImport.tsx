import { useId } from "react";
import { Form } from "react-router";
import type { BlueprintOffer } from "~/lib/courses/blueprintImport";
import { bloomLabel } from "~/lib/courses/bloom";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import type { CourseData } from "~/lib/courses/types";
import { Button, Input, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { useOutcomeName } from "./fields";
import { useQuestionCount } from "./ItemsMatrix";

/**
 * "Zet matrijs in cursus" (brief P26, 26.2): a confirm form for one linked
 * blueprint. The teacher picks the assessment and checks the proposed outcome
 * per row; existing questions are only replaced after an explicit tick. Works
 * without JavaScript; nothing is saved before the teacher confirms.
 */
export function BlueprintImport({
  data,
  generationId,
  offer,
}: {
  data: CourseData;
  generationId: string;
  offer: BlueprintOffer;
}) {
  const t = useT();
  const b = t.courses.blueprint;
  const locale = useLocale();
  const outcomeName = useOutcomeName();
  const count = useQuestionCount();
  const id = useId();

  if ("error" in offer)
    return (
      <p className="mt-2 text-sm text-slate-600">
        {fmt(b.cannot, { reason: b.errors[offer.error] })}
      </p>
    );

  return (
    <details className="mt-2 w-full [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
        {b.open}
      </summary>
      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="import-blueprint" />
        <input type="hidden" name="generationId" value={generationId} />
        <p className="text-sm text-slate-600">{b.intro}</p>
        {offer.totalMismatch && <p className="text-sm text-amber-800">{b.totalMismatch}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-target`}>{b.target}</Label>
            <Select id={`${id}-target`} name="assessmentId" defaultValue="new" className="mt-1">
              <option value="new">{b.newAssessment}</option>
              {data.assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${id}-title`}>{b.newTitle}</Label>
            <Input
              id={`${id}-title`}
              name="newTitle"
              maxLength={COURSE_LIMITS.title}
              placeholder={b.newTitleDefault}
              className="mt-1"
            />
          </div>
        </div>
        <ul className="space-y-2">
          {offer.rows.map((r) => (
            <li key={r.row} className="grid gap-2 sm:grid-cols-[1fr_16rem] sm:items-end">
              <div className="text-sm text-slate-700">
                <p>
                  <strong className="font-medium">{r.row}</strong> {r.outcomeName}
                </p>
                <p className="text-slate-600">
                  {fmt(b.detail, {
                    count: count(r.count),
                    bloom: r.bloom ? bloomLabel(r.bloom, locale) : b.unknown,
                    format: r.format ? t.courses.items.formats[r.format] : b.unknown,
                    points: r.pointsPerItem ?? b.unknown,
                  })}
                </p>
              </div>
              <div>
                <Label htmlFor={`${id}-${r.row}`}>{fmt(b.outcomeFor, { row: r.row })}</Label>
                <Select
                  id={`${id}-${r.row}`}
                  name={`map:${r.row}`}
                  defaultValue={offer.proposal[r.row] ?? ""}
                  className="mt-1"
                >
                  <option value="">{b.skip}</option>
                  {data.outcomes.map((o, i) => (
                    <option key={o.id} value={o.id}>
                      {`${outcomeName(i)} — ${o.text.length > 40 ? `${o.text.slice(0, 39)}…` : o.text}`}
                    </option>
                  ))}
                </Select>
              </div>
            </li>
          ))}
        </ul>
        <div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="replace"
              value="1"
              aria-describedby={`${id}-replace-hint`}
              className="mt-1"
            />
            <span>{b.replace}</span>
          </label>
          <p id={`${id}-replace-hint`} className="mt-1 text-xs text-slate-500">
            {b.replaceHint}
          </p>
        </div>
        <Button type="submit" size="sm">
          {b.apply}
        </Button>
      </Form>
    </details>
  );
}
