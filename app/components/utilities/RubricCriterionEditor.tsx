import { useId } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import {
  addLevel,
  moveCriterion,
  moveLevel,
  removeCriterion,
  removeLevel,
  RUBRIC_LIMITS,
  updateCriterion,
  updateLevel,
  type RubricCriterion,
  type RubricData,
} from "~/lib/utilities/rubric";
import { IconButton, PointsInput } from "./RubricControls";

/** One criterion with its levels (P23.2): text is edited in place, structure commits at once. */
export function CriterionEditor({
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
