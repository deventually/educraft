import { useEffect, useId, useRef, useState } from "react";
import { Copy, Lock, Printer, Trash2, UserPlus } from "lucide-react";
import { Button, HelpText, Input, Label, Textarea } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useActionToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { Locale } from "~/lib/i18n";
import {
  rubricGradeSettings,
  scoreRubric,
  toScore,
  type RubricData,
  type RubricOutcome,
} from "~/lib/utilities/rubric";
import {
  addStudent,
  clearBatch,
  loadBatch,
  newBatch,
  removeStudent,
  saveBatch,
  setLevel,
  studentLabel,
  updateStudent,
  type LocalBatch,
  type LocalStudent,
} from "~/lib/privacy/localNames";
import { copyText, formatGrade, formatNumber } from "./format";

export interface FillableRubric {
  id: string;
  name: string;
  data: RubricData;
}

/** What the route action answers to "Batch afsluiten". */
export type FillResult = { closed: number } | { error: string };

type Messages = ReturnType<typeof useT>["utilities"]["rubric"]["fill"];

/**
 * Filling in a rubric in a batch (P23.3). Names, comments and the chosen levels stay in this
 * browser (`localNames`); the only post is "Batch afsluiten", which carries anonymous
 * criterion → level pairs of the complete fill-ins. The browser wipes the batch only once the
 * server has stored them (`result`), so a refusal loses nothing.
 */
export function RubricFill({ rubric, result }: { rubric: FillableRubric; result?: FillResult }) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const locale = useLocale();
  const id = useId();
  const { data } = rubric;
  const [batch, setBatch] = useState<LocalBatch>(() => newBatch(rubric.id));
  const [selected, setSelected] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState(false);
  // Saving waits until the stored batch has been read, so the empty first render never wipes it.
  const [ready, setReady] = useState(false);

  // The batch lives in localStorage, which only exists in the browser: read it after mount.
  useEffect(() => {
    const stored = loadBatch(rubric.id);
    if (stored) {
      setBatch(stored);
      setSelected(stored.students[0]?.code ?? null);
    }
    setReady(true);
  }, [rubric.id]);

  useEffect(() => {
    if (!ready) return;
    if (batch.students.length === 0) clearBatch(rubric.id);
    else saveBatch(batch);
  }, [ready, batch, rubric.id]);

  // Wipe the batch once the server has kept the anonymous scores; a refusal keeps everything.
  const settled = useRef<FillResult | undefined>(undefined);
  useEffect(() => {
    if (!result || settled.current === result) return;
    settled.current = result;
    if ("closed" in result) {
      clearBatch(rubric.id);
      setBatch(newBatch(rubric.id));
      setSelected(null);
    }
  }, [result, rubric.id]);
  useActionToast(result, (r) =>
    "closed" in r
      ? { variant: "success", message: fmt(f.closed, { n: r.closed }) }
      : { variant: "error", message: f.closeError },
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const codeLabel = (n: number) => fmt(f.code, { n });
  const complete = batch.students.flatMap((s) => {
    const score = toScore(data, s.levels);
    return score ? [score] : [];
  });
  const student = batch.students.find((s) => s.code === selected) ?? null;

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const next = addStudent(batch, newName);
    setBatch(next);
    setSelected(next.nextCode - 1);
    setNewName("");
  };

  const onCopy = async () => {
    const text = batchToTsv(data, batch, f, codeLabel, locale);
    if (await copyText(text)) setCopied(true);
  };

  return (
    <div className="flex flex-col gap-8">
      <p className="flex max-w-[70ch] items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-4 text-sm text-slate-700">
        <Lock className="mt-0.5 size-4 shrink-0 text-violet-700" aria-hidden />
        <span>{f.privacy}</span>
      </p>

      <form onSubmit={onAdd} className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="min-w-[14rem] flex-1 sm:max-w-sm">
          <Label htmlFor={`${id}-new`}>{f.newName}</Label>
          <Input
            id={`${id}-new`}
            value={newName}
            maxLength={200}
            autoComplete="off"
            onChange={(e) => setNewName(e.target.value)}
            aria-describedby={`${id}-new-hint`}
            className="mt-1"
          />
          <HelpText id={`${id}-new-hint`}>{f.newNameHint}</HelpText>
        </div>
        <Button type="submit" variant="secondary">
          <UserPlus className="size-4" aria-hidden />
          {f.add}
        </Button>
      </form>

      {batch.students.length === 0 ? (
        <p className="text-slate-600">{f.empty}</p>
      ) : (
        <>
          <StudentTable
            data={data}
            batch={batch}
            selected={selected}
            onSelect={setSelected}
            codeLabel={codeLabel}
          />

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button type="button" variant="secondary" onClick={onCopy}>
              <Copy className="size-4" aria-hidden />
              {copied ? f.copied : f.copy}
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              {f.print}
            </Button>
            {complete.length > 0 ? (
              <ConfirmDialog
                triggerLabel={f.close}
                triggerVariant="primary"
                triggerSize="md"
                title={f.closeTitle}
                description={fmt(f.closeBody, {
                  complete: complete.length,
                  all: batch.students.length,
                })}
                confirmLabel={f.close}
                confirmVariant="primary"
                cancelLabel={t.confirm.cancel}
                fields={{ intent: "closeBatch", scoresJson: JSON.stringify(complete) }}
              />
            ) : (
              <p className="text-sm text-slate-600">{f.closeHint}</p>
            )}
          </div>

          {student && (
            <StudentForm
              key={student.code}
              data={data}
              student={student}
              outcome={scoreRubric(data, student.levels)}
              label={studentLabel(student, codeLabel)}
              onLevel={(criterionId, levelId) =>
                setBatch((b) => setLevel(b, student.code, criterionId, levelId))
              }
              onChange={(patch) => setBatch((b) => updateStudent(b, student.code, patch))}
              onRemove={() => {
                setBatch((b) => removeStudent(b, student.code));
                setSelected(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function outcomeText(
  o: RubricOutcome,
  f: Messages,
  decimals: number,
  locale: Locale,
): { line: string; result: string } {
  const points = formatNumber(o.total, locale);
  const max = formatNumber(o.max, locale);
  if (!o.complete) return { line: fmt(f.outcome, { points, max }), result: f.incomplete };
  const line =
    o.grade === null
      ? fmt(f.outcome, { points, max })
      : fmt(f.outcomeGrade, { points, max, grade: formatGrade(o.grade, decimals, locale) });
  const result = o.knockoutFailed ? f.knockoutFailed : o.passed ? f.passed : f.failed;
  return { line, result };
}

function StudentTable({
  data,
  batch,
  selected,
  onSelect,
  codeLabel,
}: {
  data: RubricData;
  batch: LocalBatch;
  selected: number | null;
  onSelect: (code: number) => void;
  codeLabel: (n: number) => string;
}) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const locale = useLocale();
  const { decimals } = rubricGradeSettings(data);
  return (
    // `relative` keeps the sr-only header inside the scroll box, so the page never scrolls sideways.
    <div className="relative overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="px-4 py-2 text-left font-medium text-slate-700">
          {f.studentsCaption}
        </caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.student}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.total}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.grade}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {f.columns.result}
            </th>
            <th scope="col" className="print:hidden">
              <span className="sr-only">{f.edit}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {batch.students.map((s) => {
            const o = scoreRubric(data, s.levels);
            const label = studentLabel(s, codeLabel);
            const isSelected = s.code === selected;
            return (
              <tr
                key={s.code}
                className={`border-t border-slate-100 ${isSelected ? "bg-violet-50/60" : ""}`}
              >
                <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                  {label}
                </th>
                <td className="px-3 py-2 text-slate-700">
                  {formatNumber(o.total, locale)} / {formatNumber(o.max, locale)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {o.grade === null ? "–" : formatGrade(o.grade, decimals, locale)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {!o.complete ? f.incomplete : o.knockoutFailed || !o.passed ? f.failed : f.passed}
                </td>
                <td className="px-3 py-2 text-right print:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={fmt(f.editLabel, { student: label })}
                    aria-pressed={isSelected}
                    onClick={() => onSelect(s.code)}
                  >
                    {f.edit}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StudentForm({
  data,
  student,
  outcome,
  label,
  onLevel,
  onChange,
  onRemove,
}: {
  data: RubricData;
  student: LocalStudent;
  outcome: RubricOutcome;
  label: string;
  onLevel: (criterionId: string, levelId: string) => void;
  onChange: (patch: Partial<Pick<LocalStudent, "name" | "comment">>) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const exportText = t.utilities.rubric.export;
  const locale = useLocale();
  const id = useId();
  const { decimals } = rubricGradeSettings(data);
  const { line, result } = outcomeText(outcome, f, decimals, locale);
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id={`${id}-heading`} className="font-display text-lg font-medium text-slate-900">
          {label}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={fmt(f.remove, { student: label })}
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
          {t.utilities.rubric.delete}
        </Button>
      </div>

      <div className="max-w-sm">
        <Label htmlFor={`${id}-name`}>{f.name}</Label>
        <Input
          id={`${id}-name`}
          value={student.name}
          maxLength={200}
          autoComplete="off"
          onChange={(e) => onChange({ name: e.target.value })}
          className="mt-1"
        />
      </div>

      {data.criteria.map((c) => (
        <fieldset key={c.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-slate-800">
            {c.title}
            {c.knockout && (
              <span className="ml-1 font-normal text-slate-500">({exportText.knockout})</span>
            )}
          </legend>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(13rem,100%),1fr))]">
            {c.levels.map((l) => {
              const inputId = `${id}-${c.id}-${l.id}`;
              return (
                <label
                  key={l.id}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50"
                >
                  <input
                    id={inputId}
                    type="radio"
                    name={`${id}-${c.id}`}
                    value={l.id}
                    checked={student.levels[c.id] === l.id}
                    onChange={() => onLevel(c.id, l.id)}
                    className="mt-1 size-4 accent-violet-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-slate-900">
                      {fmt(f.levelOption, {
                        label: l.label,
                        points: formatNumber(l.points * (c.weight ?? 1), locale),
                      })}
                    </span>
                    {l.description && (
                      <span className="mt-0.5 block text-slate-600">{l.description}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div>
        <Label htmlFor={`${id}-comment`}>{f.comment}</Label>
        <Textarea
          id={`${id}-comment`}
          value={student.comment}
          rows={3}
          maxLength={2000}
          onChange={(e) => onChange({ comment: e.target.value })}
          className="mt-1"
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-900"
      >
        {line} {result}
      </p>
    </section>
  );
}

/** The teacher's overview, with names, as tab-separated text (pastes into Excel or Word). */
function batchToTsv(
  data: RubricData,
  batch: LocalBatch,
  f: Messages,
  codeLabel: (n: number) => string,
  locale: Locale,
): string {
  const { decimals } = rubricGradeSettings(data);
  const cell = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();
  const header = [
    f.columns.student,
    ...data.criteria.map((c) => c.title),
    f.columns.total,
    f.columns.grade,
    f.columns.result,
    f.columns.comment,
  ];
  const rows = batch.students.map((s) => {
    const o = scoreRubric(data, s.levels);
    const levels = data.criteria.map(
      (c) => c.levels.find((l) => l.id === s.levels[c.id])?.label ?? "",
    );
    const result = !o.complete ? f.incomplete : o.knockoutFailed || !o.passed ? f.failed : f.passed;
    return [
      studentLabel(s, codeLabel),
      ...levels,
      formatNumber(o.total, locale),
      o.grade === null ? "" : formatGrade(o.grade, decimals, locale),
      result,
      s.comment,
    ];
  });
  return [header, ...rows].map((r) => r.map(cell).join("\t")).join("\n");
}
