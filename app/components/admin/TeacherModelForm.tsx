import { useState } from "react";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { cn } from "~/lib/utils";

export type ModelBox = { id: string; displayName: string };
export type TeacherRow = {
  id: string;
  name: string | null;
  email: string | null;
  mode: "inherit" | "own";
  models: string[];
};

/** One checkbox per model in `base`, pre-checked by `checkedIds`; all disabled together. */
export function ModelCheckboxes({
  idPrefix,
  base,
  checkedIds,
  disabled,
}: {
  idPrefix: string;
  base: ModelBox[];
  checkedIds: string[];
  disabled: boolean;
}) {
  return (
    <ul className="mt-2 space-y-2.5">
      {base.map((m) => (
        <li key={m.id} className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id={`${idPrefix}-${m.id}`}
            name="models"
            value={m.id}
            defaultChecked={checkedIds.includes(m.id)}
            disabled={disabled}
            className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
          />
          <label
            htmlFor={`${idPrefix}-${m.id}`}
            className={cn("text-sm font-medium text-slate-800", disabled && "text-slate-400")}
          >
            {m.displayName}
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * One teacher's model form (P18): "follows the instance" or "own selection". An own
 * selection replaces the instance set, so its checkboxes run over the whole
 * catalogue; they are disabled (and not submitted) while the teacher follows the
 * instance. It saves itself (`AutoSaveForm`); `mode` mirrors the radio only to
 * enable/disable the boxes, and is put back when a refused save resets the form.
 */
export function TeacherModelForm({
  teacher,
  base,
  errorMessage,
  inheritLabel,
  ownLabel,
}: {
  teacher: TeacherRow;
  base: ModelBox[];
  errorMessage: (code: string | true) => string | undefined;
  inheritLabel: string;
  ownLabel: string;
}) {
  const [mode, setMode] = useState(teacher.mode);
  const radio = (value: "inherit" | "own", label: string) => (
    <div className="flex items-center gap-2.5">
      <input
        type="radio"
        id={`teacher-${teacher.id}-mode-${value}`}
        name="mode"
        value={value}
        defaultChecked={teacher.mode === value}
        onChange={() => setMode(value)}
        className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
      />
      <label
        htmlFor={`teacher-${teacher.id}-mode-${value}`}
        className="text-sm font-medium text-slate-800"
      >
        {label}
      </label>
    </div>
  );
  return (
    <AutoSaveForm
      intent="teacherModels"
      hidden={{ userId: teacher.id }}
      errorMessage={errorMessage}
      onReset={() => setMode(teacher.mode)}
    >
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-slate-800">{teacher.name}</legend>
        {teacher.email && <p className="text-xs text-slate-500">{teacher.email}</p>}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {radio("inherit", inheritLabel)}
          {radio("own", ownLabel)}
        </div>
        <ModelCheckboxes
          idPrefix={`teacher-${teacher.id}-model`}
          base={base}
          checkedIds={teacher.models}
          disabled={mode === "inherit"}
        />
      </fieldset>
    </AutoSaveForm>
  );
}
