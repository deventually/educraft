import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import { Calculator, Copy, Plus } from "lucide-react";
import { Button, Input, Label } from "~/components/ui";
import { useActionToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  addCriterion,
  maxPoints,
  newCriterion,
  RUBRIC_LIMITS,
  rubricToMarkdown,
  rubricGradeSettings,
  rubricToTsv,
  type RubricData,
} from "~/lib/utilities/rubric";
import { copyText, formatNumber } from "./format";
import { CriterionEditor } from "./RubricCriterionEditor";
import { GradeSettings } from "./RubricGradeSettings";
import { RubricTable } from "./RubricTable";

export interface EditableRubric {
  id: string;
  name: string;
  data: RubricData;
}

interface Draft {
  name: string;
  data: RubricData;
}

type SaveResult = { ok: true } | { error: string } | undefined;

/**
 * The rubric editor (P23.2). It saves itself like the admin tables (P18.5): a structural change
 * (add, remove, move, a checkbox) posts at once, text posts on blur when it changed, and the toast
 * is the only thing that reports. A refused save springs back to the last saved rubric.
 * Each post carries the whole rubric (`dataJson`), which the action re-parses with the schema.
 */
export function RubricEditor({ rubric }: { rubric: EditableRubric }) {
  const t = useT();
  const r = t.utilities.rubric;
  const locale = useLocale();
  const id = useId();
  const fetcher = useFetcher<SaveResult>();
  const [draft, setDraft] = useState<Draft>({ name: rubric.name, data: rubric.data });
  const saved = useRef<Draft>({ name: rubric.name, data: rubric.data });
  const sentJson = useRef(JSON.stringify(saved.current));
  const pending = useRef<Draft | null>(null);
  const [copied, setCopied] = useState<"tsv" | "md" | null>(null);

  const save = (next: Draft) => {
    const json = JSON.stringify(next);
    if (json === sentJson.current) return;
    sentJson.current = json;
    pending.current = next;
    void fetcher.submit(
      { intent: "save", name: next.name, dataJson: JSON.stringify(next.data) },
      { method: "post" },
    );
  };

  /** A finished change (button, checkbox): apply and save at once. */
  const commit = (data: RubricData) => {
    const next = { ...draft, data };
    setDraft(next);
    save(next);
  };
  /** A change while typing: apply, save on blur. */
  const edit = (data: RubricData) => setDraft((d) => ({ ...d, data }));
  const onBlurSave = () => save(draft);

  useActionToast(fetcher.data, (d) =>
    d && "error" in d
      ? { variant: "error", message: r.invalid }
      : { variant: "success", message: r.saved },
  );

  // Settle each response: a success becomes the new saved state, a refusal springs back.
  const settledFor = useRef<unknown>(null);
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !d || settledFor.current === d) return;
    settledFor.current = d;
    if ("error" in d) {
      sentJson.current = JSON.stringify(saved.current);
      setDraft(saved.current);
    } else if (pending.current) {
      saved.current = pending.current;
    }
    pending.current = null;
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const { data } = draft;
  const total = maxPoints(data);
  const defaultLevels = [
    { label: r.defaultLevels.fail, points: 0 },
    { label: r.defaultLevels.pass, points: 1 },
    { label: r.defaultLevels.good, points: 2 },
  ];

  const onCopy = async (kind: "tsv" | "md") => {
    const text = kind === "tsv" ? rubricToTsv(data, r.export) : rubricToMarkdown(data, r.export);
    if (await copyText(text)) setCopied(kind);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="max-w-xl">
        <Label htmlFor={`${id}-name`}>{r.name}</Label>
        <Input
          id={`${id}-name`}
          value={draft.name}
          maxLength={RUBRIC_LIMITS.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onBlur={onBlurSave}
          className="mt-1"
        />
      </div>

      <ol className="flex list-none flex-col gap-5 p-0">
        {data.criteria.map((c, i) => (
          <li key={c.id}>
            <CriterionEditor
              criterion={c}
              n={i + 1}
              isFirst={i === 0}
              isLast={i === data.criteria.length - 1}
              canRemove={data.criteria.length > 1}
              data={data}
              commit={commit}
              edit={edit}
              onBlurSave={onBlurSave}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={data.criteria.length >= RUBRIC_LIMITS.criteria}
          onClick={() =>
            commit(addCriterion(data, newCriterion(r.defaultCriterion, defaultLevels)))
          }
        >
          <Plus className="size-4" aria-hidden />
          {r.addCriterion}
        </Button>
      </div>

      <GradeSettings
        grade={rubricGradeSettings(data)}
        onCommit={(grade) => commit({ ...data, grade })}
      />

      <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-3">
        <h2 id={`${id}-preview`} className="font-display text-lg font-medium text-slate-900">
          {r.preview}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-900">
            {fmt(r.maxPoints, { points: formatNumber(total, locale) })}
          </p>
          <Link
            to={`/utilities/grade-calculator?max=${total}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline"
          >
            <Calculator className="size-4" aria-hidden />
            {r.toGrade}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => onCopy("tsv")}>
            <Copy className="size-4" aria-hidden />
            {copied === "tsv" ? r.copied : r.copyTable}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onCopy("md")}>
            <Copy className="size-4" aria-hidden />
            {copied === "md" ? r.copied : r.copyMarkdown}
          </Button>
        </div>
        <p className="text-sm text-slate-600">{r.exportHint}</p>
        <RubricTable data={data} caption={r.previewCaption} />
      </section>
    </div>
  );
}
