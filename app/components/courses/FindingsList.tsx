import { useId } from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { AlignmentFinding } from "~/lib/courses/alignment";
import { findingText } from "~/lib/courses/findingText";
import type { CourseData } from "~/lib/courses/types";
import { useLocale, useT } from "~/lib/i18n/useT";
import { type CourseTools, findingItemId, type ToolRef } from "~/lib/registry/courseActions";
import { SolveWith } from "./ItemTools";

export { plannedHours } from "~/lib/courses/findingText";

/** Advisory findings as plain text with a severity icon. Not a live region: the toast announces saves. */
export function FindingsList({
  data,
  findings,
  courseId,
  tools,
}: {
  data: CourseData;
  findings: AlignmentFinding[];
  /** With both, a finding that has a tool gets "Los op met…" (P27.4). */
  courseId?: string;
  tools?: CourseTools;
}) {
  const t = useT();
  const f = t.courses.findings;
  const locale = useLocale();
  const id = useId();

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
              key={`${finding.code}-${finding.outcomeId ?? ""}-${finding.itemId ?? ""}-${finding.questionId ?? ""}`}
              className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800"
            >
              {finding.severity === "warning" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
              ) : (
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
              )}
              <div>
                <p>
                  <strong className="font-medium">{f.severity[finding.severity]}:</strong>{" "}
                  {findingText(finding, data, locale)}
                </p>
                {courseId && tools?.findings[finding.code] && (
                  <SolveWith
                    tool={tools.findings[finding.code] as ToolRef}
                    courseId={courseId}
                    itemId={findingItemId(data, finding.itemId)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
