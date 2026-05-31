import type { InputField } from "~/lib/registry/types";
import type { ImageInput } from "~/lib/ai/types";
import { Label, Input, Textarea, Select, HelpText } from "./ui";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";
import { filesToImageInputs } from "~/lib/images/process";
import { useState, useCallback } from "react";

export type FormValues = Record<string, string | number | boolean | string[] | ImageInput[]>;

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
  const locale = useLocale();
  const id = `f-${field.name}`;
  return (
    <div>
      {field.kind !== "boolean" && field.kind !== "image" && (
        <Label htmlFor={id} required={field.required} className="mb-1.5">
          {loc(field.label, locale)}
        </Label>
      )}
      {renderControl(field, id, value, onChange, locale)}
      {field.help && <HelpText>{loc(field.help, locale)}</HelpText>}
    </div>
  );
}

function renderControl(
  field: InputField,
  id: string,
  value: FormValues[string],
  onChange: (v: FormValues[string]) => void,
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
      const selected =
        Array.isArray(value) && typeof value[0] === "string" ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-2">
          {field.options?.map((o) => {
            const active = selected.includes(o.value);
            return (
              <button
                type="button"
                key={o.value}
                onClick={() => {
                  const newSelected = active
                    ? selected.filter((v) => v !== o.value)
                    : [...selected, o.value];
                  onChange(newSelected as FormValues[string]);
                }}
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
    case "image":
      return (
        <ImageInputControl
          id={id}
          value={(value as ImageInput[]) ?? []}
          accept={field.accept ?? "image/*"}
          onChange={onChange}
          label={loc(field.label, locale)}
        />
      );
    case "file":
      return (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          File upload coming soon
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

interface ImageInputControlProps {
  id: string;
  value: ImageInput[];
  accept: string;
  onChange: (v: ImageInput[]) => void;
  label: string;
}

function ImageInputControl({ id, value, accept, onChange, label }: ImageInputControlProps) {
  const t = useT();
  const [error, setError] = useState<string | undefined>();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.currentTarget.files ?? []);
      if (files.length === 0) return;

      try {
        setError(undefined);
        const newImages = await filesToImageInputs(files, accept);
        onChange([...value, ...newImages]);
        // Reset input after successful upload
        const input = document.getElementById(id) as HTMLInputElement;
        if (input) input.value = "";
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process images";
        setError(message);
        console.warn("Image upload validation failed:", message);
      }
    },
    [value, accept, onChange, id],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-3">
      <Label required htmlFor={id} className="mb-1.5">
        {label}
      </Label>

      {/* File input (visually hidden, triggered by button) */}
      <input
        id={id}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={handleFileChange}
        aria-label={t.tool.imageUploadLabel}
      />

      {/* Upload button */}
      <label htmlFor={id} className="block">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            const input = document.getElementById(id) as HTMLInputElement;
            input?.click();
          }}
          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        >
          {t.tool.imageUploadLabel}
        </button>
      </label>

      {/* Error message */}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Preview grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {value.map((img, i) => (
            <div
              key={img.dataBase64.slice(0, 32)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
            >
              {/* Thumbnail */}
              <img
                src={`data:${img.mediaType};base64,${img.dataBase64}`}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />

              {/* Remove button overlay */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 transition-all group-hover:bg-opacity-50"
                title={t.tool.imageRemove}
                aria-label={`${t.tool.imageRemove} image ${i + 1}`}
              >
                <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-900 opacity-0 transition-opacity group-hover:opacity-100">
                  {t.tool.imageRemove}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Image count indicator */}
      {value.length > 0 && (
        <p className="text-xs text-slate-600">
          {value.length} image{value.length !== 1 ? "s" : ""} uploaded
        </p>
      )}
    </div>
  );
}

function groupBy(fields: InputField[], locale: Locale): Array<[string | undefined, InputField[]]> {
  const map = new Map<string | undefined, InputField[]>();
  for (const f of fields) {
    const key = f.group ? loc(f.group, locale) : undefined;
    const bucket = map.get(key);
    if (bucket) bucket.push(f);
    else map.set(key, [f]);
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
