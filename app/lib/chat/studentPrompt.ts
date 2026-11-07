import type { InputField } from "~/lib/registry/types";
import { interpolate, type TemplateValue } from "~/lib/template/interpolate";

/**
 * Fill the copied student text (P31.1) with what the teacher entered. A field left empty
 * becomes "", so no `{{placeholder}}` ever reaches a student.
 */
export function fillStudentPrompt(
  template: string,
  inputs: InputField[],
  values: Record<string, unknown>,
): string {
  const filled = Object.fromEntries(
    inputs.map((f) => [f.name, (values[f.name] ?? "") as TemplateValue]),
  );
  return interpolate(template, filled, { allowEmpty: inputs.map((f) => f.name) });
}
