import { type ReactNode, useId } from "react";
import type { ModelChoice } from "~/lib/assessment-models";
import type { FormValues } from "~/lib/forms/values";
import { useAssessmentModel } from "~/lib/hooks/useAssessmentModel";
import type { Tool } from "~/lib/registry/types";
import { HelpText, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/** Picks the assessment model that fills the framework and scale below it. */
function AssessmentModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: ModelChoice[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const t = useT().assessmentModels;
  const id = useId();
  const own = models.filter((m) => !m.starter);
  const starters = models.filter((m) => m.starter);
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5">
        {t.pickerLabel}
      </Label>
      <Select
        id={id}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{t.pickerNone}</option>
        {own.length > 0 && (
          <optgroup label={t.pickerOwn}>
            {own.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={t.pickerStarters}>
          {starters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </optgroup>
      </Select>
      <HelpText id={`${id}-help`}>
        {t.pickerHelp}{" "}
        <a href="/assessment-models" className="font-medium text-violet-700 underline">
          {t.pickerManage}
        </a>
      </HelpText>
    </div>
  );
}

/**
 * For a form: the picker, placed right above the first field an assessment model fills.
 * Undefined for a tool without `assessmentModels`.
 */
export function useAssessmentModelPicker(
  tool: Tool,
  models: ModelChoice[],
  sandbox: {
    values: FormValues;
    setValues: (update: (prev: FormValues) => FormValues) => void;
  },
  disabled: boolean,
): Record<string, ReactNode> | undefined {
  const model = useAssessmentModel(tool, models, sandbox.values, sandbox.setValues);
  const field = tool.inputs.find((f) => f.prefillFromAssessmentModel)?.name;
  if (!model.enabled || !field) return undefined;
  return {
    [field]: (
      <AssessmentModelPicker
        models={models}
        value={model.modelId}
        onChange={model.choose}
        disabled={disabled}
      />
    ),
  };
}
