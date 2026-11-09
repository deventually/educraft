import { useEffect, useId, useRef, useState } from "react";
import { Copy, Lock, Printer, UserPlus } from "lucide-react";
import { Button, HelpText, Input, Label } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useActionToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { scoreRubric, toScore, type RubricData } from "~/lib/utilities/rubric";
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
} from "~/lib/privacy/localNames";
import { copyText } from "./format";
import { batchToTsv } from "./rubricFillText";
import { StudentForm } from "./RubricStudentForm";
import { StudentTable } from "./RubricStudentTable";

export interface FillableRubric {
  id: string;
  name: string;
  data: RubricData;
}

/** What the route action answers to "Batch afsluiten". */
export type FillResult = { closed: number } | { error: string };

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
