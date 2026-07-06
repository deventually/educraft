import { useId } from "react";
import type { ContextProfile } from "~/lib/context/types";
import type { OutputLanguage } from "~/lib/registry/types";
import { pickableModels, type PickerModel } from "~/lib/ai/models";
import { Label, Select } from "./ui";
import { useT } from "~/lib/i18n/useT";

export type { PickerModel };

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
  /** Admin-configured catalog allow-list (Phase 4); omitted → full client-selectable catalog. */
  catalogModels?: PickerModel[];
  disabled?: boolean;
  /** If true, filter to only vision-capable models. */
  requiresImages?: boolean;
}

export function ToolControls(props: Props) {
  const t = useT();
  // Unique ids so each label is programmatically associated with its select
  // (accessible name), even if two ToolControls render on one page.
  const uid = useId();
  const profileId = `${uid}-profile`;
  const languageId = `${uid}-language`;
  const modelId = `${uid}-model`;
  const models = pickableModels(
    props.localModels ?? [],
    props.requiresImages ?? false,
    props.catalogModels,
  );

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-3">
      {props.usesContextProfile && (
        <div>
          <Label htmlFor={profileId} className="mb-1.5">
            {t.tool.contextProfile}
          </Label>
          <Select
            id={profileId}
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
        <Label htmlFor={languageId} className="mb-1.5">
          {t.tool.outputLanguage}
        </Label>
        <Select
          id={languageId}
          value={props.outputLanguage}
          onChange={(e) => props.onLanguage(e.target.value as OutputLanguage)}
          disabled={props.disabled}
        >
          <option value="nl">{t.tool.dutch}</option>
          <option value="en">{t.tool.english}</option>
        </Select>
      </div>
      <div>
        <Label htmlFor={modelId} className="mb-1.5">
          {t.tool.model}
        </Label>
        <Select
          id={modelId}
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
