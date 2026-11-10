import type { FormValues } from "~/lib/forms/values";
import type { InputField } from "~/lib/registry/types";

/** A model as the tool page offers it: the teacher's own or a starter, in one language. */
export interface ModelChoice {
  id: string;
  name: string;
  documentTypes: string[];
  framework: string;
  scale: string;
  starter: boolean;
}

/**
 * The teacher's own model for a document type: the first that lists it. A starter is never
 * picked by itself, so nobody gets another programme's rubric without choosing it.
 */
export function ownModelFor(models: ModelChoice[], documentType: string): ModelChoice | undefined {
  return models.find((m) => !m.starter && m.documentTypes.includes(documentType));
}

/** The values a model gives the fields that take one; no model empties them. */
export function applyAssessmentModel(
  fields: InputField[],
  model: ModelChoice | undefined,
): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const source = f.prefillFromAssessmentModel?.source;
    if (source) out[f.name] = model ? model[source] : "";
  }
  return out;
}

/**
 * Whether the model-backed fields still hold what was last filled in (or are empty when
 * nothing was), so another model may replace them without losing the teacher's own text.
 */
export function untouchedSince(
  fields: InputField[],
  values: FormValues,
  applied: FormValues | undefined,
): boolean {
  return fields
    .filter((f) => f.prefillFromAssessmentModel)
    .every((f) => {
      const now = String(values[f.name] ?? "").trim();
      return now === "" || now === String(applied?.[f.name] ?? "").trim();
    });
}
