import { AlertTriangle } from "lucide-react";
import type { GateHealth } from "~/lib/privacy/gateHealth";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/**
 * The anonymiseerpoort's counters on the health screen (PR 5): one line for the week, the counts
 * per kind folded behind it, and a warning outside the fold when one kind suddenly goes off far
 * more often. Counts only, never a word.
 */
export function GateCounts({ gate }: { gate: GateHealth }) {
  const g = useT().adminPrivacy.health;
  const spikes = gate.kinds.filter((k) => k.spike);
  return (
    <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
      {spikes.map((k) => (
        <p
          key={k.kind}
          className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-900"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {fmt(g.spike, { kind: g.kinds[k.kind], recent: k.recent, previous: k.previous })}
        </p>
      ))}
      <details>
        <summary className="cursor-pointer text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600">
          {fmt(g.callsSummary, { calls: gate.calls, stopped: gate.stopped })}
        </summary>
        <div className="mt-2 max-w-md overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{g.caption}</caption>
            <thead className="text-xs text-slate-600">
              <tr>
                <th scope="col" className="py-1 pr-4 font-medium">
                  {g.colKind}
                </th>
                <th scope="col" className="py-1 pr-4 text-right font-medium">
                  {g.colRecent}
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  {g.colPrevious}
                </th>
              </tr>
            </thead>
            <tbody>
              {gate.kinds.map((k) => (
                <tr key={k.kind} className="border-t border-slate-100">
                  <th scope="row" className="py-1 pr-4 text-left font-normal text-slate-700">
                    {g.kinds[k.kind]}
                  </th>
                  <td className="py-1 pr-4 text-right tabular-nums font-medium text-slate-900">
                    {k.recent}
                  </td>
                  <td className="py-1 text-right tabular-nums text-slate-700">{k.previous}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-slate-500">{g.countsOnly}</p>
        </div>
      </details>
    </div>
  );
}
