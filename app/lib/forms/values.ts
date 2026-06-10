import type { ImageInput } from "~/lib/ai/types";
import type { InputField } from "~/lib/registry/types";
import type { TemplateValues } from "~/lib/template/interpolate";

/** The shape of a tool's input form: one entry per {@link InputField} name. */
export type FormValues = Record<string, string | number | boolean | string[] | ImageInput[]>;

/**
 * Narrow form values to the placeholder-substitutable subset accepted by
 * `buildSystemPrompt`. Image arrays are dropped: they travel to the API in a
 * separate `images` field and never fill a `{{placeholder}}`. This is the one
 * seam between the client's {@link FormValues} and the engine's TemplateValues.
 */
export function toTemplateValues(values: FormValues): TemplateValues {
  const out: TemplateValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value) && typeof value[0] === "object") continue;
    out[key] = value as TemplateValues[string];
  }
  return out;
}

/**
 * Initial form values for a set of fields. Each value is seeded so the stored
 * value always matches what the control renders — crucially for a `select`,
 * whose default is its first option's value. A controlled `<select>` whose
 * value matches no `<option>` visually shows the first option but holds `""`,
 * so the user's apparent choice would never reach the prompt.
 */
export function defaultValuesFor(fields: InputField[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) values[f.name] = f.defaultValue;
    else if (f.kind === "multiselect") values[f.name] = [];
    else if (f.kind === "boolean") values[f.name] = false;
    else if (f.kind === "number") values[f.name] = f.min ?? 0;
    else if (f.kind === "select") values[f.name] = f.options?.[0]?.value ?? "";
    else values[f.name] = "";
  }
  return values;
}
