import type { InputField } from "~/lib/registry/types";
import { Label, Input, Textarea, Select, HelpText } from "./ui";
import { DictateButton } from "./DictateButton";
import { appendDictation } from "~/lib/speech/dictation";
import { cn } from "~/lib/utils";
import { useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";
import { DOC_ACCEPT_ATTR } from "~/lib/documents/extract";
import { useState } from "react";
import { DocumentFigurePicker } from "./documents/DocumentFigurePicker";
import { DocumentInputControl } from "./form/DocumentInputControl";
import { ImageInputControl, asImages } from "./form/ImageInputControl";

// Form value shape and defaults live in a framework-free module so they can be
// imported in node tests without pulling in React. Re-exported here for the
// many call sites that import them alongside the form component. The local
// `import type` is needed because a bare `export … from` re-export does not
// bind the name in this module's own scope (used in annotations below).
import type { FormValues } from "~/lib/forms/values";
export { defaultValuesFor, profilePrefillValues, type FormValues } from "~/lib/forms/values";

interface Props {
  fields: InputField[];
  values: FormValues;
  onChange: (name: string, value: FormValues[string]) => void;
  /**
   * Called with the picked files of a `kind: "document"` field, so the caller
   * can show the original next to the text (DocumentViewer). The files stay in
   * the browser; the field's value is still only the extracted text.
   */
  onDocumentFiles?: (name: string, files: File[]) => void;
}

export function DynamicForm({ fields, values, onChange, onDocumentFiles }: Props) {
  const locale = useLocale();
  const groups = groupBy(fields, locale);
  // The files picked per document field, so an image field with `imagesFrom`
  // can offer their figures. They stay in browser memory.
  const [docFiles, setDocFiles] = useState<Record<string, File[]>>({});
  const handleFiles = (name: string, files: File[]) => {
    setDocFiles((prev) => ({ ...prev, [name]: files }));
    onDocumentFiles?.(name, files);
  };
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
              onFiles={(files) => handleFiles(field.name, files)}
              sourceFiles={field.imagesFrom ? docFiles[field.imagesFrom] : undefined}
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
  onFiles,
  sourceFiles,
}: {
  field: InputField;
  value: FormValues[string] | undefined;
  onChange: (v: FormValues[string]) => void;
  onFiles?: (files: File[]) => void;
  /** For an image field with `imagesFrom`: the files uploaded in that document field. */
  sourceFiles?: File[];
}) {
  const locale = useLocale();
  const id = `f-${field.name}`;
  return (
    <div>
      {field.kind === "textarea" ? (
        // A textarea can be dictated: the microphone sits at the end of its label row.
        <div className="mb-1.5 flex items-end justify-between gap-2">
          <Label htmlFor={id} required={field.required}>
            {loc(field.label, locale)}
          </Label>
          <DictateButton
            lang={locale}
            field={loc(field.label, locale)}
            onText={(text) => onChange(appendDictation(String(value ?? ""), text))}
          />
        </div>
      ) : (
        field.kind !== "boolean" &&
        field.kind !== "image" && (
          <Label htmlFor={id} required={field.required} className="mb-1.5">
            {loc(field.label, locale)}
          </Label>
        )
      )}
      {renderControl(field, id, value, onChange, locale, onFiles, sourceFiles)}
      {field.help && <HelpText>{loc(field.help, locale)}</HelpText>}
    </div>
  );
}

function renderControl(
  field: InputField,
  id: string,
  value: FormValues[string] | undefined,
  onChange: (v: FormValues[string]) => void,
  locale: Locale,
  onFiles?: (files: File[]) => void,
  sourceFiles?: File[],
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
          {placeholder && <option value="">{placeholder}</option>}
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
          value={asImages(value)}
          accept={field.accept ?? "image/*"}
          onChange={onChange}
          label={loc(field.label, locale)}
          required={field.required}
          picked={
            sourceFiles && sourceFiles.length > 0 ? (
              <DocumentFigurePicker
                files={sourceFiles}
                value={asImages(value)}
                onChange={onChange}
              />
            ) : undefined
          }
        />
      );
    case "document":
      return (
        <DocumentInputControl
          id={id}
          value={String(value ?? "")}
          accept={field.accept ?? DOC_ACCEPT_ATTR}
          rows={field.rows ?? 12}
          placeholder={placeholder}
          onChange={onChange}
          onFiles={onFiles}
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
