import { useRef, useState } from "react";
import {
  applyAssessmentModel,
  type ModelChoice,
  ownModelFor,
  untouchedSince,
} from "~/lib/assessment-models";
import type { FormValues } from "~/lib/forms/values";
import type { Tool } from "~/lib/registry/types";

/**
 * The assessment model of a tool with `assessmentModels`: the teacher's own model for the
 * chosen document type is filled in by itself, a starter only when picked. Text the teacher
 * typed is never overwritten by a change of document type.
 */
export function useAssessmentModel(
  tool: Tool,
  models: ModelChoice[],
  values: FormValues,
  setValues: (update: (prev: FormValues) => FormValues) => void,
) {
  const byField = tool.assessmentModels?.byField;
  const documentType = byField ? String(values[byField] ?? "") : "";
  const [modelId, setModelId] = useState("");
  // The document type last acted on; null until the first render has picked.
  const [seenType, setSeenType] = useState<string | null>(null);
  // What the last model filled in, to tell the teacher's own text apart from it.
  const applied = useRef<FormValues | undefined>(undefined);

  const apply = (model: ModelChoice | undefined) => {
    const filled = applyAssessmentModel(tool.inputs, model);
    applied.current = model ? filled : undefined;
    setModelId(model?.id ?? "");
    setValues((prev) => ({ ...prev, ...filled }));
  };

  // A new document type re-picks during render (no effect, so no flash of the old model).
  if (byField && seenType !== documentType) {
    setSeenType(documentType);
    const current = models.find((m) => m.id === modelId);
    const fits =
      current &&
      (current.documentTypes.length === 0 || current.documentTypes.includes(documentType));
    if (!fits && untouchedSince(tool.inputs, values, applied.current))
      apply(ownModelFor(models, documentType));
  }

  /** The teacher picks a model; "" lets go of it, emptying the fields only if untouched. */
  const choose = (id: string) => {
    const model = models.find((m) => m.id === id);
    if (model || untouchedSince(tool.inputs, values, applied.current)) apply(model);
    else {
      applied.current = undefined;
      setModelId("");
    }
  };

  return { enabled: Boolean(byField), modelId, choose };
}
