import type { InputField } from "~/lib/registry/types";
import { Label, Input, Textarea, Select, HelpText } from "./ui";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";

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
  const locale = useLocale();
  const groups = groupBy(fields, locale);
  return (
    <div className="space-y-6">
      {groups.map(([group, groupFields]) => (
        <fieldset key={group ?? "_"} className="space-y-4">
          {group && (
            <legend className="text-xs font-semibold uppercase tracking-wide text-brass-600">
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
  const locale = useLocale();
  const id = `f-${field.name}`;
  return (
    <div>
      {field.kind !== "boolean" && (
        <Label htmlFor={id} required={field.required} className="mb-1.5">
          {loc(field.label, locale)}
        </Label>
      )}
      {renderControl(field, id, value, onChange, t.tool.fileComingSoon, locale)}
      {field.help && <HelpText>{loc(field.help, locale)}</HelpText>}
    </div>
  );
}

function renderControl(
  field: InputField,
  id: string,
  value: FormValues[string],
  onChange: (v: FormValues[string]) => void,
  fileComingSoon: string,
  locale: Locale,
) {
  const placeholder = loc(field.placeholder, locale) || undefined;
  switch (field.kind) {
    case "textarea":
      return (
        <Textarea
          id={id}
          rows={field.rows ?? 3}
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "select":
      return (
        <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {loc(o.label, locale)}
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
          {loc(field.label, locale)}
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
                  onChange(active ? selected.filter((v) => v !== o.value) : [...selected, o.value])
                }
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-violet-600 bg-violet-50 text-violet-700"
                    : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {loc(o.label, locale)}
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
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function groupBy(fields: InputField[], locale: Locale): Array<[string | undefined, InputField[]]> {
  const map = new Map<string | undefined, InputField[]>();
  for (const f of fields) {
    const key = f.group ? loc(f.group, locale) : undefined;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return [...map.entries()];
}

/** Client-side required-field check. Returns the missing required fields. */
export function missingRequired(fields: InputField[], values: FormValues): InputField[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.name];
      if (Array.isArray(v)) return v.length === 0;
      return v === undefined || v === null || String(v).trim() === "";
    });
}
