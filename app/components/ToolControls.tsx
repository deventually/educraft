import type { ContextProfile } from "~/lib/context/types";
import type { OutputLanguage } from "~/lib/registry/types";
import { listModels } from "~/lib/ai/models";
import { Label, Select } from "./ui";
import { useT } from "~/lib/i18n/useT";

/** Minimal shape needed to render an <option> (static or discovered local). */
export interface PickerModel {
  id: string;
  displayName: string;
  supportsImages?: boolean;
}

interface Props {
  usesContextProfile: boolean;
  profiles: ContextProfile[];
  contextProfileId: string;
  onProfile: (id: string) => void;
  outputLanguage: OutputLanguage;
  onLanguage: (l: OutputLanguage) => void;
  model: string;
  onModel: (m: string) => void;
  /** Local models discovered at runtime (Ollama / LM Studio), appended to the catalog. */
  localModels?: PickerModel[];
  disabled?: boolean;
  /** If true, filter to only vision-capable models. */
  requiresImages?: boolean;
}

export function ToolControls(props: Props) {
  const t = useT();
  let models: PickerModel[] = [...listModels(), ...(props.localModels ?? [])];

  // Filter to vision-capable models if tool requires images
  if (props.requiresImages) {
    models = models.filter((m) => m.supportsImages !== false);
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
      {props.usesContextProfile && (
        <div>
          <Label className="mb-1.5">{t.tool.contextProfile}</Label>
          <Select
            value={props.contextProfileId}
            onChange={(e) => props.onProfile(e.target.value)}
            disabled={props.disabled}
          >
            <option value="">{t.tool.noProfile}</option>
            {props.profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div>
        <Label className="mb-1.5">{t.tool.outputLanguage}</Label>
        <Select
          value={props.outputLanguage}
          onChange={(e) => props.onLanguage(e.target.value as OutputLanguage)}
          disabled={props.disabled}
        >
          <option value="nl">{t.tool.dutch}</option>
          <option value="en">{t.tool.english}</option>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5">{t.tool.model}</Label>
        <Select
          value={props.model}
          onChange={(e) => props.onModel(e.target.value)}
          disabled={props.disabled}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
