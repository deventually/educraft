import type { InputField } from "~/lib/registry/types";
import { Label, Input, Textarea, Select, HelpText } from "./ui";
import { cn } from "~/lib/utils";
import { useT } from "~/lib/i18n/useT";

export type FormValues = Record<string, string | number | boolean | string[]>;

export function defaultValuesFor(fields: InputField[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) values[f.name] = f.defaultValue;
    else if (f.kind === "multiselect") values[f.name] = [];
    else if (f.kind === "boolean") values[f.name] = false;
    else if (f.kind === "number") values[f.name] = f.min ?? 0;
    else values[f.name] = "";
  }
  return values;
}

interface Props {
  fields: InputField[];
  values: FormValues;
  onChange: (name: string, value: FormValues[string]) => void;
}

export function DynamicForm({ fields, values, onChange }: Props) {
  const groups = groupBy(fields);
  return (
    <div className="space-y-6">
      {groups.map(([group, groupFields]) => (
        <fieldset key={group ?? "_"} className="space-y-4">
          {group && (
            <legend className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              {group}
            </legend>
          )}
          {groupFields.map((field) => (
            <FieldControl
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(v) => onChange(field.name, v)}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: InputField;
  value: FormValues[string];
  onChange: (v: FormValues[string]) => void;
}) {
  const t = useT();
  const id = `f-${field.name}`;
  return (
    <div>
      {field.kind !== "boolean" && (
        <Label htmlFor={id} required={field.required} className="mb-1.5">
          {field.label}
        </Label>
      )}
      {renderControl(field, id, value, onChange, t.tool.fileComingSoon)}
      {field.help && <HelpText>{field.help}</HelpText>}
    </div>
  );
}

function renderControl(
  field: InputField,
  id: string,
  value: FormValues[string],
  onChange: (v: FormValues[string]) => void,
  fileComingSoon: string,
) {
  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          id={id}
          rows={field.rows ?? 3}
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      );
    case "number":
      return (
        <Input
          id={id}
          type="number"
          min={field.min}
          max={field.max}
          step={field.step}
          value={Number.isFinite(value as number) ? (value as number) : ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        />
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      );
    case "multiselect": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() =>
                  onChange(
                    active ? selected.filter((v) => v !== o.value) : [...selected, o.value],
                  )
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-violet-600 bg-violet-50 text-violet-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "file":
    case "image":
      return (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {fileComingSoon}
        </p>
      );
    default:
      return (
        <Input
          id={id}
          type="text"
          placeholder={field.placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function groupBy(fields: InputField[]): Array<[string | undefined, InputField[]]> {
  const map = new Map<string | undefined, InputField[]>();
  for (const f of fields) {
    const key = f.group;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return [...map.entries()];
}

/** Client-side required-field check. Returns names of missing required fields. */
export function missingRequired(fields: InputField[], values: FormValues): string[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.name];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || String(v).trim() === "";
    })
    .map((f) => f.label);
}
