import { useId } from "react";
import { Form } from "react-router";
import type { CourseData } from "~/lib/courses/types";
import { Button, Label, Select } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export interface DossierTarget {
  id: string;
  name: string;
  outcomes: { code: string; title: string; criteria: { id: string; text: string }[] }[];
}

/**
 * "Gebruik als bewijs in BDB/BKE" (brief P26, 26.4): a snapshot of the outcomes
 * and coverage matrix, or of one test's blueprint, goes into a dossier as
 * evidence. A plain form: the server checks that each criterion is in the
 * chosen dossier. Renders nothing without dossiers.
 */
export function CourseEvidence({
  data,
  dossiers,
}: {
  data: CourseData;
  dossiers: DossierTarget[];
}) {
  const t = useT();
  const e = t.courses.evidence;
  const id = useId();
  if (dossiers.length === 0) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white p-4 [&[open]>summary]:mb-3">
      <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
        {e.open}
      </summary>
      <Form method="post" className="space-y-3">
        <input type="hidden" name="intent" value="use-as-evidence" />
        <p className="text-sm text-slate-600">{e.intro}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${id}-part`}>{e.part}</Label>
            <Select
              id={`${id}-part`}
              name="part"
              defaultValue="outcomes-and-matrix"
              className="mt-1"
            >
              <option value="outcomes-and-matrix">{e.partOutcomes}</option>
              {data.assessments.map((a) => (
                <option key={a.id} value={`assessment:${a.id}`}>
                  {fmt(t.courses.items.caption, { assessment: a.title })}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${id}-dossier`}>{e.dossier}</Label>
            <Select id={`${id}-dossier`} name="dossierId" className="mt-1">
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
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
