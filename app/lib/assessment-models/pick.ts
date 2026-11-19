import type { FormValues } from "~/lib/forms/values";
import type { InputField, Tool } from "~/lib/registry/types";

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
 * The teacher's own model for a document type: the first that lists it. Two documents together
 * (`a+b`) fall back to the first own model that lists every part. A starter is never picked by
 * itself, so nobody gets another programme's rubric without choosing it.
 */
export function ownModelFor(models: ModelChoice[], documentType: string): ModelChoice | undefined {
  const own = models.filter((m) => !m.starter);
  const parts = documentType.split("+");
  return (
    own.find((m) => m.documentTypes.includes(documentType)) ??
    (parts.length > 1
      ? own.find((m) => parts.every((p) => m.documentTypes.includes(p)))
      : undefined)
  );
}

/**
 * The models a tool offers: those for one of its document types (the options of
 * `assessmentModels.byField`), or for none in particular. So a reflection model never shows up
 * when assessing a thesis, nor a thesis rubric under feedback on a reflection (P39.3).
 */
export function modelsForTool(
  models: ModelChoice[],
  tool: Pick<Tool, "inputs" | "assessmentModels">,
): ModelChoice[] {
  const by = tool.assessmentModels?.byField;
  const types = new Set(tool.inputs.find((f) => f.name === by)?.options?.map((o) => o.value));
  return models.filter(
    (m) => m.documentTypes.length === 0 || m.documentTypes.some((t) => types.has(t)),
  );
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
