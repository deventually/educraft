import { useEffect, useId, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Calculator,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button, Input, Label, Textarea } from "~/components/ui";
import { useActionToast } from "~/components/Toast";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  addCriterion,
  addLevel,
  maxPoints,
  moveCriterion,
  moveLevel,
  newCriterion,
  removeCriterion,
  removeLevel,
  RUBRIC_LIMITS,
  rubricToMarkdown,
  rubricToTsv,
  updateCriterion,
  updateLevel,
  type RubricCriterion,
  type RubricData,
} from "~/lib/utilities/rubric";
import { copyText, formatNumber, parseNumber } from "./format";

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

function CriterionEditor({
  criterion: c,
  n,
  isFirst,
  isLast,
  canRemove,
  data,
  commit,
  edit,
  onBlurSave,
}: {
  criterion: RubricCriterion;
  n: number;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  data: RubricData;
  commit: (d: RubricData) => void;
  edit: (d: RubricData) => void;
  onBlurSave: () => void;
}) {
  const t = useT();
  const r = t.utilities.rubric;
  const id = useId();
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <legend className="px-1 text-sm font-semibold text-slate-700">
        {fmt(r.criterion, { n })}
      </legend>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1">
          <Label htmlFor={`${id}-title`}>{r.criterionTitle}</Label>
          <Input
            id={`${id}-title`}
            value={c.title}
            maxLength={RUBRIC_LIMITS.title}
            onChange={(e) => edit(updateCriterion(data, c.id, { title: e.target.value }))}
            onBlur={onBlurSave}
            className="mt-1"
          />
        </div>
        <div className="flex gap-1">
          <IconButton
            label={fmt(r.moveUp, { n })}
            disabled={isFirst}
            onClick={() => commit(moveCriterion(data, c.id, -1))}
          >
            <ArrowUp className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={fmt(r.moveDown, { n })}
            disabled={isLast}
            onClick={() => commit(moveCriterion(data, c.id, 1))}
          >
            <ArrowDown className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={fmt(r.removeCriterion, { n })}
            disabled={!canRemove}
            onClick={() => commit(removeCriterion(data, c.id))}
          >
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2">
        <input
          id={`${id}-knockout`}
          type="checkbox"
          checked={c.knockout ?? false}
          onChange={(e) => commit(updateCriterion(data, c.id, { knockout: e.target.checked }))}
          className="mt-0.5 size-4 accent-violet-600"
        />
        <Label htmlFor={`${id}-knockout`} className="font-normal">
          {r.knockout}
        </Label>
      </div>

      <ol className="mt-4 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(13rem,100%),1fr))]">
        {c.levels.map((l, j) => {
          const m = j + 1;
          return (
            <li key={l.id}>
              <fieldset className="flex h-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <legend className="px-1 text-xs font-semibold text-slate-600">
                  {fmt(r.level, { n: m })}
                </legend>
                <div>
                  <Label htmlFor={`${id}-${l.id}-label`}>{r.levelLabel}</Label>
                  <Input
                    id={`${id}-${l.id}-label`}
                    value={l.label}
                    maxLength={RUBRIC_LIMITS.title}
                    onChange={(e) => edit(updateLevel(data, c.id, l.id, { label: e.target.value }))}
                    onBlur={onBlurSave}
                    className="mt-1"
                  />
                </div>
                <PointsInput
                  id={`${id}-${l.id}-points`}
                  label={r.levelPoints}
                  value={l.points}
                  onCommit={(points) => commit(updateLevel(data, c.id, l.id, { points }))}
                />
                <div className="flex-1">
                  <Label htmlFor={`${id}-${l.id}-desc`}>{r.levelDescription}</Label>
                  <Textarea
                    id={`${id}-${l.id}-desc`}
                    value={l.description}
                    rows={3}
                    maxLength={RUBRIC_LIMITS.text}
                    onChange={(e) =>
                      edit(updateLevel(data, c.id, l.id, { description: e.target.value }))
                    }
                    onBlur={onBlurSave}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end gap-1">
                  <IconButton
                    label={fmt(r.moveLeft, { n: m })}
                    disabled={j === 0}
                    onClick={() => commit(moveLevel(data, c.id, l.id, -1))}
                  >
                    <ArrowLeft className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={fmt(r.moveRight, { n: m })}
                    disabled={j === c.levels.length - 1}
                    onClick={() => commit(moveLevel(data, c.id, l.id, 1))}
                  >
                    <ArrowRight className="size-4" aria-hidden />
                  </IconButton>
                  <IconButton
                    label={fmt(r.removeLevel, { n: m })}
                    disabled={c.levels.length <= RUBRIC_LIMITS.minLevels}
                    onClick={() => commit(removeLevel(data, c.id, l.id))}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconButton>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={c.levels.length >= RUBRIC_LIMITS.maxLevels}
          onClick={() => commit(addLevel(data, c.id, r.newLevel))}
        >
          <Plus className="size-4" aria-hidden />
          {r.addLevel}
        </Button>
      </div>
    </fieldset>
  );
}

/** Points as typed text (decimal comma allowed); commits a clamped number on blur. */
function PointsInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  onCommit: (points: number) => void;
}) {
  const locale = useLocale();
  const shown = formatNumber(value, locale);
  const [text, setText] = useState(shown);
  // Follow a new saved value (a move, a revert) during render, not in an effect: a late effect
  // after mount could overwrite what the teacher has just started typing.
  const [prevShown, setPrevShown] = useState(shown);
  if (shown !== prevShown) {
    setPrevShown(shown);
    setText(shown);
  }
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseNumber(text);
          const points = Number.isFinite(n)
            ? Math.min(RUBRIC_LIMITS.points, Math.max(0, n))
            : value;
          setText(formatNumber(points, locale));
          if (points !== value) onCommit(points);
        }}
        className="mt-1 w-24"
      />
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Read-only criteria × levels table, for the desktop overview and print. */
export function RubricTable({ data, caption }: { data: RubricData; caption: string }) {
  const t = useT();
  const locale = useLocale();
  const r = t.utilities.rubric;
  const width = Math.max(...data.criteria.map((c) => c.levels.length));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="px-4 py-2 text-left font-medium text-slate-700">{caption}</caption>
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {r.export.criterion}
            </th>
            {Array.from({ length: width }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {fmt(r.level, { n: i + 1 })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.criteria.map((c) => (
            <tr key={c.id} className="border-t border-slate-100 align-top">
              <th scope="row" className="px-3 py-2 font-semibold text-slate-900">
                {c.title}
                {c.knockout && (
                  <span className="ml-1 font-normal text-slate-500">({r.export.knockout})</span>
                )}
              </th>
              {Array.from({ length: width }, (_, i) => {
                const l = c.levels[i];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: columns are positions
                  <td key={i} className="px-3 py-2 text-slate-700">
                    {l && (
                      <>
                        <span className="font-medium text-slate-900">{l.label}</span>{" "}
                        <span className="text-slate-500">
                          ({formatNumber(l.points, locale)} {r.export.points})
                        </span>
                        {l.description && <p className="mt-1">{l.description}</p>}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
