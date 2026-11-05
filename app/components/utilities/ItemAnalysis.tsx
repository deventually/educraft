import { useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Copy, Sparkles } from "lucide-react";
import { Button, HelpText, Input, Label, Textarea } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { analyse, parseScores } from "~/lib/utilities/item-analysis";
import { analysisMarkdown } from "~/lib/utilities/item-analysis/report";
import { writeHandoff } from "~/lib/forms/handoff";
import { copyText, formatNumber } from "./format";

const TAG = { nl: "nl-NL", en: "en-GB" } as const;

/**
 * Item analysis after a test (P24.5a). Recalculates as the teacher pastes; the score list never
 * leaves the browser. "Laat uitleggen" hands only the per-question numbers to the explaining tool
 * (`explainWith`, passed only when that tool is available to this teacher).
 */
export function ItemAnalysis({ explainWith }: { explainWith?: string }) {
  const t = useT();
  const a = t.utilities.itemAnalysis;
  const locale = useLocale();
  const id = useId();
  const navigate = useNavigate();
  const [scores, setScores] = useState("");
  const [max, setMax] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const parsed = useMemo(() => parseScores(scores, max), [scores, max]);
  const stats = useMemo(() => (parsed.ok ? analyse(parsed.table) : null), [parsed]);
  const two = new Intl.NumberFormat(TAG[locale], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
  const num = (v: number | null) => (v === null ? "–" : two.format(v));
  const markdown = () =>
    parsed.ok && stats
      ? analysisMarkdown(
          stats,
          { blanks: parsed.blanks, maxFromData: parsed.maxFromData },
          a.report,
          locale,
        )
      : "";

  const errorId = `${id}-error`;
  const maxError = !parsed.ok && /^max|aboveMax/.test(parsed.error);
  const c = a.report.columns;

  const onExplain = () => {
    if (!explainWith || !stats) return;
    writeHandoff(explainWith, { analysis: markdown() });
    void navigate(`/tools/${explainWith}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <form className="flex max-w-3xl flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <Label htmlFor={`${id}-scores`}>{a.scores}</Label>
          <Textarea
            id={`${id}-scores`}
            rows={8}
            spellCheck={false}
            autoComplete="off"
            value={scores}
            onChange={(e) => setScores(e.target.value)}
            className="mt-1 font-mono text-sm"
            aria-describedby={`${id}-scores-hint`}
            {...(!parsed.ok && !maxError && parsed.error !== "empty"
              ? { "aria-invalid": true as const }
              : {})}
          />
          <HelpText id={`${id}-scores-hint`}>{a.scoresHint}</HelpText>
        </div>
        <div className="max-w-sm">
          <Label htmlFor={`${id}-max`}>{a.max}</Label>
          <Input
            id={`${id}-max`}
            inputMode="decimal"
            autoComplete="off"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="mt-1"
            aria-describedby={maxError ? `${id}-max-hint ${errorId}` : `${id}-max-hint`}
            {...(maxError ? { "aria-invalid": true as const } : {})}
          />
          <HelpText id={`${id}-max-hint`}>{a.maxHint}</HelpText>
        </div>
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-slate-700">{a.privacy}</p>
      </form>

      <section aria-labelledby={`${id}-result`} className="min-w-0">
        <h2 id={`${id}-result`} className="font-display text-lg font-medium text-slate-900">
          {a.result}
        </h2>
        <div aria-live="polite" className="mt-3 flex flex-col gap-1 text-sm text-slate-700">
          {parsed.ok && stats ? (
            <>
              <p className="text-base font-semibold text-slate-900">
                {fmt(a.summary, { candidates: stats.candidates, items: stats.items.length })}
              </p>
              <p>
                {stats.alpha === null
                  ? a.alphaNone
                  : fmt(a.alpha, { value: two.format(stats.alpha) })}
              </p>
              <p>
                {fmt(a.meanTotal, {
                  mean: two.format(stats.meanTotal),
                  max: formatNumber(stats.maxTotal, locale),
                  sd: two.format(stats.sdTotal),
                })}
              </p>
              {parsed.removedColumns.length > 0 && (
                <p className="text-amber-800">
                  {fmt(a.removed, { columns: parsed.removedColumns.join(", ") })}
                </p>
              )}
              {parsed.blanks > 0 && <p>{fmt(a.blanks, { n: parsed.blanks })}</p>}
              {parsed.maxFromData && <p>{a.maxFromData}</p>}
            </>
          ) : (
            <p
              id={errorId}
              className={parsed.ok || parsed.error === "empty" ? "" : "font-medium text-red-700"}
            >
              {parsed.ok ? "" : a.errors[parsed.error]}
            </p>
          )}
        </div>

        {parsed.ok && stats && (
          <>
            <div className="mt-4 flex flex-wrap items-start gap-2">
              {explainWith && (
                <Button type="button" onClick={onExplain} aria-describedby={`${id}-explain-hint`}>
                  <Sparkles className="size-4" aria-hidden />
                  {a.explain}
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={async () => setCopied(await copyText(markdown()))}
              >
                <Copy className="size-4" aria-hidden />
                {copied ? a.copied : a.copy}
              </Button>
            </div>
            {explainWith && <HelpText id={`${id}-explain-hint`}>{a.explainHint}</HelpText>}
            <h3 id={`${id}-table`} className="mt-6 text-sm font-medium text-slate-700">
              {a.tableCaption}
            </h3>
            {/* Scrolls sideways on a phone; focusable so keyboard users can scroll it too. */}
            <section
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable (WCAG 2.1.1)
              tabIndex={0}
              aria-labelledby={`${id}-table`}
              className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white focus-visible:outline-2 focus-visible:outline-violet-600"
            >
              <table
                aria-labelledby={`${id}-table`}
                className="w-full min-w-[34rem] text-left text-sm"
              >
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    {[c.question, c.max, c.p, c.rit, c.rir, c.alphaIfDeleted].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.items.map((i, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: labels may repeat; rows are positional and rerender together
                    <tr key={`${i.item}-${j}`} className="border-t border-slate-100">
                      <th scope="row" className="px-4 py-1.5 font-normal">
                        {i.item}
                      </th>
                      <td className="px-4 py-1.5 tabular-nums">{formatNumber(i.max, locale)}</td>
                      <td className="px-4 py-1.5 tabular-nums">{num(i.p)}</td>
                      <td className="px-4 py-1.5 tabular-nums">{num(i.rit)}</td>
                      <td className="px-4 py-1.5 tabular-nums">{num(i.rir)}</td>
                      <td className="px-4 py-1.5 tabular-nums">{num(i.alphaIfDeleted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <p className="mt-3 max-w-[70ch] text-sm text-slate-600">{a.legend}</p>
          </>
        )}
      </section>
    </div>
  );
}
