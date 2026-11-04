import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Copy, Printer } from "lucide-react";
import { Button, HelpText, Input, Label, Select } from "~/components/ui";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  cutScore,
  DEFAULT_SCALE,
  gradeTable,
  guessScore,
  parseGradeScale,
  type GradeScaleError,
} from "~/lib/utilities/grade";
import { copyText, formatGrade, formatNumber, parseNumber } from "./format";

interface Draft {
  maxPoints: string;
  passPercent: string;
  minGrade: string;
  passGrade: string;
  maxGrade: string;
  decimals: string;
  guessing: boolean;
  options: string;
}

/** Which field carries the error (aria-invalid + aria-describedby). */
const ERROR_FIELD: Record<GradeScaleError, keyof Draft> = {
  maxPoints: "maxPoints",
  passPercent: "passPercent",
  gradeOrder: "passGrade",
  options: "options",
  decimals: "decimals",
};

/**
 * Points → grade (P23.1). Recalculates on every keystroke; nothing is stored, so there is no
 * toast. The pass mark sits in a polite live region.
 */
export function GradeCalculator() {
  const t = useT();
  const g = t.utilities.grade;
  const locale = useLocale();
  const id = useId();
  const [copied, setCopied] = useState(false);
  // A rubric links here with its maximum filled in (?max=12).
  const [params] = useSearchParams();
  const fromRubric = parseNumber(params.get("max") ?? "");
  const [draft, setDraft] = useState<Draft>({
    maxPoints:
      Number.isFinite(fromRubric) && fromRubric > 0 ? formatNumber(fromRubric, locale) : "30",
    passPercent: String(DEFAULT_SCALE.passPercent),
    minGrade: String(DEFAULT_SCALE.minGrade),
    passGrade: formatNumber(DEFAULT_SCALE.passGrade, locale),
    maxGrade: String(DEFAULT_SCALE.maxGrade),
    decimals: String(DEFAULT_SCALE.decimals),
    guessing: false,
    options: "4",
  });

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const parsed = useMemo(
    () =>
      parseGradeScale({
        maxPoints: parseNumber(draft.maxPoints),
        passPercent: parseNumber(draft.passPercent),
        minGrade: parseNumber(draft.minGrade),
        passGrade: parseNumber(draft.passGrade),
        maxGrade: parseNumber(draft.maxGrade),
        decimals: Number(draft.decimals),
        ...(draft.guessing ? { guessing: { options: parseNumber(draft.options) } } : {}),
      }),
    [draft],
  );

  const errorField = parsed.ok ? null : ERROR_FIELD[parsed.error];
  const errorId = `${id}-error`;
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  const invalid = (key: keyof Draft) =>
    errorField === key ? { "aria-invalid": true as const, "aria-describedby": errorId } : {};

  const result = parsed.ok
    ? {
        scale: parsed.scale,
        cut: cutScore(parsed.scale),
        guess: guessScore(parsed.scale),
        rows: gradeTable(parsed.scale),
      }
    : null;

  const onCopy = async () => {
    if (!result) return;
    const lines = [
      `${g.points}\t${g.grade}`,
      ...result.rows.map(
        (r) =>
          `${formatNumber(r.points, locale)}\t${formatGrade(r.grade, result.scale.decimals, locale)}`,
      ),
    ];
    setCopied(await copyText(lines.join("\n")));
  };

  const numberField = (key: keyof Draft, label: string, hint?: string) => (
    <div>
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input
        id={`${id}-${key}`}
        inputMode="decimal"
        autoComplete="off"
        value={draft[key] as string}
        onChange={set(key)}
        className="mt-1"
        {...(hint && errorField !== key ? { "aria-describedby": `${id}-${key}-hint` } : {})}
        {...invalid(key)}
      />
      {hint && <HelpText id={`${id}-${key}-hint`}>{hint}</HelpText>}
    </div>
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <form className="flex flex-col gap-5 print:hidden" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-lg font-medium text-slate-900">
            {g.basics}
          </legend>
          {numberField("maxPoints", g.maxPoints)}
          {numberField("passPercent", g.passPercent, g.passPercentHint)}
        </fieldset>

        <details className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-800">{g.more}</summary>
          <div className="mt-4 flex flex-col gap-4">
            {numberField("minGrade", g.minGrade)}
            {numberField("passGrade", g.passGrade)}
            {numberField("maxGrade", g.maxGrade)}
            <div>
              <Label htmlFor={`${id}-decimals`}>{g.decimals}</Label>
              <Select
                id={`${id}-decimals`}
                value={draft.decimals}
                onChange={set("decimals")}
                className="mt-1"
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </Select>
            </div>
            <div>
              <div className="flex items-start gap-2">
                <input
                  id={`${id}-guessing`}
                  type="checkbox"
                  checked={draft.guessing}
                  onChange={(e) => setDraft((d) => ({ ...d, guessing: e.target.checked }))}
                  aria-describedby={`${id}-guessing-hint`}
                  className="mt-0.5 size-4 accent-violet-600"
                />
                <Label htmlFor={`${id}-guessing`}>{g.guessing}</Label>
              </div>
              <HelpText id={`${id}-guessing-hint`}>{g.guessingHint}</HelpText>
            </div>
            {draft.guessing && numberField("options", g.options)}
          </div>
        </details>
      </form>

      <section aria-labelledby={`${id}-result`} className="min-w-0">
        <h2
          id={`${id}-result`}
          className="font-display text-lg font-medium text-slate-900 print:hidden"
        >
          {g.result}
        </h2>
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-700">{g.oer}</p>

        <div aria-live="polite" className="mt-4">
          {result ? (
            <>
              <p className="text-base font-semibold text-slate-900">
                {fmt(g.cutScore, {
                  points: formatNumber(result.cut, locale),
                  max: formatNumber(result.scale.maxPoints, locale),
                })}
              </p>
              {result.scale.guessing && (
                <p className="text-sm text-slate-600">
                  {fmt(g.guessScore, { points: formatNumber(result.guess, locale) })}
                </p>
              )}
            </>
          ) : (
            <p id={errorId} className="text-sm font-medium text-red-700">
              {parsed.ok ? "" : g.errors[parsed.error]}
            </p>
          )}
        </div>

        {result && (
          <>
            <div className="mt-4 flex flex-wrap gap-2 print:hidden">
              <Button type="button" variant="secondary" onClick={onCopy}>
                <Copy className="size-4" aria-hidden />
                {copied ? g.copied : g.copy}
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                <Printer className="size-4" aria-hidden />
                {g.print}
              </Button>
            </div>
            <div className="mt-4 max-w-sm overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <caption className="px-4 py-2 text-left font-medium text-slate-700">
                  {g.tableCaption}
                </caption>
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {g.points}
                    </th>
                    <th scope="col" className="px-4 py-2 font-medium">
                      {g.grade}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr
                      key={r.points}
                      className={
                        r.grade >= result.scale.passGrade
                          ? "border-t border-slate-100"
                          : "border-t border-slate-100 text-slate-500"
                      }
                    >
                      <th scope="row" className="px-4 py-1.5 font-normal tabular-nums">
                        {formatNumber(r.points, locale)}
                      </th>
                      <td className="px-4 py-1.5 tabular-nums">
                        {formatGrade(r.grade, result.scale.decimals, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
