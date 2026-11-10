/**
 * The editor of one assessment model: name, the document types it fills in by itself, the
 * framework (required) and the scale (optional: empty means feedback only). Pass `model` to
 * edit it (hidden `id` + `intent="update"`).
 */
import { useId } from "react";
import { Form, useNavigation } from "react-router";
import { Button, HelpText, Input, Label, Textarea } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export interface EditableModel {
  id: string;
  name: string;
  data: { documentTypes: string[]; framework: string; scale: string };
}

export function AssessmentModelEditor({
  model,
  documentTypes,
  onCancel,
}: {
  model?: EditableModel;
  documentTypes: { value: string; label: string }[];
  onCancel: () => void;
}) {
  const t = useT().assessmentModels;
  const busy = useNavigation().state !== "idle";
  const id = useId();
  const chosen = new Set(model?.data.documentTypes ?? []);
  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="intent" value={model ? "update" : "create"} />
      {model && <input type="hidden" name="id" value={model.id} />}
      <div>
        <Label htmlFor={`${id}-name`} required className="mb-1.5">
          {t.name}
        </Label>
        <Input id={`${id}-name`} name="name" required maxLength={120} defaultValue={model?.name} />
      </div>
      <fieldset aria-describedby={`${id}-types-help`}>
        <legend className="mb-1.5 text-sm font-medium text-slate-800">{t.documentTypes}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {documentTypes.map((d) => (
            <label key={d.value} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="documentTypes"
                value={d.value}
                defaultChecked={chosen.has(d.value)}
                className="focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              {d.label}
            </label>
          ))}
        </div>
        <HelpText id={`${id}-types-help`}>{t.documentTypesHelp}</HelpText>
      </fieldset>
      <div>
        <Label htmlFor={`${id}-framework`} required className="mb-1.5">
          {t.framework}
        </Label>
        <Textarea
          id={`${id}-framework`}
          name="framework"
          required
          rows={12}
          defaultValue={model?.data.framework}
          aria-describedby={`${id}-framework-help`}
        />
        <HelpText id={`${id}-framework-help`}>{t.frameworkHelp}</HelpText>
      </div>
      <div>
        <Label htmlFor={`${id}-scale`} className="mb-1.5">
          {t.scale}
        </Label>
        <Textarea
          id={`${id}-scale`}
          name="scale"
          rows={4}
          defaultValue={model?.data.scale}
          aria-describedby={`${id}-scale-help`}
        />
        <HelpText id={`${id}-scale-help`}>{t.scaleHelp}</HelpText>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {t.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </Form>
  );
}
