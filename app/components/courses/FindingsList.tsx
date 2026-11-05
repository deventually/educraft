import { useId } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { AlignmentFinding } from "~/lib/courses/alignment";
import { type CourseData, HOURS_PER_EC } from "~/lib/courses/types";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { useOutcomeName } from "./fields";

export function plannedHours(data: CourseData): number {
  return [...data.activities, ...data.assessments].reduce((s, i) => s + (i.hours ?? 0), 0);
}

/** Advisory findings as plain text with a severity icon. Not a live region: the toast announces saves. */
export function FindingsList({
  data,
  findings,
}: {
  data: CourseData;
  findings: AlignmentFinding[];
}) {
  const t = useT();
  const f = t.courses.findings;
  const outcomeName = useOutcomeName();
  const id = useId();
  const outcome = (outcomeId?: string) => {
    const i = data.outcomes.findIndex((o) => o.id === outcomeId);
    return i < 0 ? "" : outcomeName(i);
  };
  const item = (itemId?: string) =>
    [...data.activities, ...data.assessments].find((x) => x.id === itemId)?.title ?? "";

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {f.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{f.intro}</p>
      {findings.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{f.none}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {findings.map((finding) => (
            <li
              key={`${finding.code}-${finding.outcomeId ?? ""}-${finding.itemId ?? ""}`}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800"
            >
              {finding.severity === "warning" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
              )}
              <span>
                <strong className="font-medium">{f.severity[finding.severity]}:</strong>{" "}
                {fmt(f.codes[finding.code], {
                  outcome: outcome(finding.outcomeId),
                  item: item(finding.itemId),
                  hours: plannedHours(data),
                  budget: (data.ec ?? 0) * HOURS_PER_EC,
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
