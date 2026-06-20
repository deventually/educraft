import type { ImageInput } from "~/lib/ai/types";
import type { InputField } from "~/lib/registry/types";
import type { ContextProfile } from "~/lib/context/types";
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
 *
 * Exception: a `select` with a `placeholder` (and no explicit `defaultValue`)
 * seeds to `""`. The control then renders a leading empty option, so "no choice
 * yet" is a real, visible state — letting a `required` select force a conscious
 * pick instead of silently submitting its first option.
 */
export function defaultValuesFor(fields: InputField[]): FormValues {
  const values: FormValues = {};
  for (const f of fields) {
    if (f.defaultValue !== undefined) values[f.name] = f.defaultValue;
    else if (f.kind === "multiselect") values[f.name] = [];
    else if (f.kind === "boolean") values[f.name] = false;
    else if (f.kind === "number") values[f.name] = f.min ?? 0;
    else if (f.kind === "select")
      values[f.name] = f.placeholder ? "" : (f.options?.[0]?.value ?? "");
    else values[f.name] = "";
  }
  return values;
}

/**
 * Values derived from the selected teaching-context profile for any field that
 * declares `prefillFromProfile`. Lets a tool reuse what the profile already
 * states (e.g. a course level from the study year) instead of asking the
 * teacher again. Returns only the fields that resolve to a non-empty value; the
 * rest keep their normal defaults, and the prefilled fields stay editable.
 */
export function profilePrefillValues(
  fields: InputField[],
  profile: ContextProfile | null | undefined,
): FormValues {
  const out: FormValues = {};
  if (!profile) return out;
  const attrs = profile as unknown as Record<string, unknown>;
  for (const f of fields) {
    const spec = f.prefillFromProfile;
    if (!spec) continue;
    const raw = attrs[spec.source];
    if (raw == null || raw === "") continue;
    // With a map, translate the (stringified) source value; without one, copy
    // the raw value through, preserving its type (e.g. a numeric study year).
    const value = spec.map ? spec.map[String(raw)] : (raw as string | number);
    if (value != null && value !== "") out[f.name] = value;
  }
  return out;
}
