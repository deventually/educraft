import { Form } from "react-router";
import { Button } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { fmtDate } from "~/lib/portfolio/format";

export interface EvidenceSuggestionView {
  generationId: string;
  toolName: string;
  createdAt: number;
  courses: string[];
}

/**
 * "Dit heb je misschien al" (27.2): earlier work that fits one criterion, with
 * checkboxes. Nothing is added until the teacher ticks and submits. Renders
 * nothing without suggestions.
 */
export function EvidenceSuggestions({
  criterionId,
  n,
  suggestions,
  className = "",
}: {
  criterionId: string;
  n: number;
  suggestions: EvidenceSuggestionView[];
  className?: string;
}) {
  const t = useT();
  const locale = useLocale();
  const ts = t.portfolio.suggest;
  if (suggestions.length === 0) return null;
  return (
    <Form method="post" className={`rounded-xl bg-violet-50 p-3 text-sm ${className}`}>
      <input type="hidden" name="intent" value="adoptSuggestions" />
      <input type="hidden" name="criterionId" value={criterionId} />
      <fieldset>
        <legend className="font-medium text-slate-900">
          {ts.title} <span className="sr-only">({n})</span>
        </legend>
        <p className="mt-1 text-slate-600">{ts.intro}</p>
        <ul className="mt-2 space-y-1">
          {suggestions.map((s) => (
            <li key={s.generationId}>
              <label className="flex items-start gap-2 text-slate-800">
                <input
                  type="checkbox"
                  name="generationIds"
                  value={s.generationId}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{s.toolName}</span>
                  {" · "}
                  {fmtDate(s.createdAt, locale)}
                  {s.courses.length > 0 &&
                    ` · ${fmt(ts.inCourses, { courses: s.courses.join(", ") })}`}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <Button type="submit" variant="secondary" size="sm" className="mt-2">
        {fmt(ts.submit, { n })}
      </Button>
    </Form>
  );
}
