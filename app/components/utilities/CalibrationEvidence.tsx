import { useId } from "react";
import { Form } from "react-router";
import { Button, Label, Select } from "~/components/ui";
import type { DossierTarget } from "~/components/courses/CourseEvidence";
import { Markdown } from "~/components/Markdown";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import {
  type Calibration,
  calibrationEvidenceText,
  calibrationSummary,
  type RubricData,
} from "~/lib/utilities/rubric";

/**
 * "Gebruik als bewijs" (P34.3): the teacher reads the summary first; only that summary (counts
 * and the rubric's criterion ids, never a code) is posted. The server builds the same text from
 * it. Renders nothing without dossiers.
 */
export function CalibrationEvidence({
  rubric,
  result,
  dossiers,
  today,
}: {
  rubric: { name: string; data: RubricData };
  result: Calibration;
  dossiers: DossierTarget[];
  today: string;
}) {
  const t = useT();
  const e = t.rubricCalibrate.evidence;
  const locale = useLocale();
  const id = useId();
  if (dossiers.length === 0) return null;
  const summary = calibrationSummary(result);
  const text = calibrationEvidenceText(rubric.data, rubric.name, summary, { date: today, locale });
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 print:hidden [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
        {e.open}
      </summary>
      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="use-as-evidence" />
        <input type="hidden" name="summary" value={JSON.stringify(summary)} />
        <p className="max-w-[70ch] text-sm text-slate-600">{e.intro}</p>
        <section
          aria-labelledby={`${id}-preview`}
          className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"
        >
          <h3 id={`${id}-preview`} className="mb-2 font-medium text-slate-800">
            {e.preview}
          </h3>
          <div className="overflow-x-auto">
            <Markdown>{text}</Markdown>
          </div>
        </section>
        <div className="max-w-sm">
          <Label htmlFor={`${id}-dossier`}>{e.dossier}</Label>
          <Select id={`${id}-dossier`} name="dossierId" className="mt-1">
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm font-medium text-slate-800">{e.criteria}</p>
        {dossiers.flatMap((d) =>
          d.outcomes
            .filter((o) => o.criteria.length > 0)
            .map((o) => (
              <fieldset key={`${d.id}-${o.code}-${o.title}`}>
                <legend className="text-sm text-slate-700">
                  {fmt(e.criteriaOf, { dossier: d.name, outcome: `${o.code} ${o.title}`.trim() })}
                </legend>
                <div className="mt-1 space-y-1">
                  {o.criteria.map((c) => (
                    <label key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="criterionIds" value={c.id} className="mt-1" />
                      <span>{c.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )),
        )}
        <Button type="submit" size="sm">
          {e.submit}
        </Button>
      </Form>
    </details>
  );
}
