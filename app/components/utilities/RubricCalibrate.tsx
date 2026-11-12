import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useT } from "~/lib/i18n/useT";
import { calibrate, calibrationTemplate, type RubricData } from "~/lib/utilities/rubric";
import { CalibrateRater, type RaterRow } from "./CalibrateRater";
import { CalibrationResult } from "./CalibrationResult";

export interface CalibratableRubric {
  id: string;
  name: string;
  data: RubricData;
}

/**
 * Calibrating with a second rater (P34.2). Everything stays in this browser: no post, no
 * storage. Only the rubric itself came from the server.
 */
export function RubricCalibrate({ rubric }: { rubric: CalibratableRubric }) {
  const t = useT();
  const s = t.rubricCalibrate;
  const { data } = rubric;
  const [a, setA] = useState<RaterRow[]>([]);
  const [b, setB] = useState<RaterRow[]>([]);
  const result = useMemo(() => calibrate(data, a, b), [data, a, b]);
  const started = a.length > 0 || b.length > 0;
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${calibrationTemplate(data)}`)}`;

  return (
    <div>
      <p className="max-w-[70ch] text-slate-700 print:hidden">{s.intro}</p>
      <p className="mt-3 text-sm print:hidden">
        <a
          href={template}
          download={`${rubric.name.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "rubric"}.csv`}
          className="inline-flex items-center gap-1.5 font-medium text-violet-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Download className="size-4" aria-hidden />
          {s.example}
        </a>
        <span className="ml-2 text-slate-600">{s.exampleHint}</span>
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <CalibrateRater n={1} data={data} rows={a} onChange={setA} />
        <CalibrateRater n={2} data={data} rows={b} onChange={setB} />
      </div>
      {started && <CalibrationResult data={data} result={result} />}
      <p className="mt-8 text-sm font-medium text-slate-700">{s.nothingKept}</p>
    </div>
  );
}
