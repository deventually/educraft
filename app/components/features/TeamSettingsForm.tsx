import { useState } from "react";
import type { TeamSettings } from "~/lib/features/teamSettings";
import type { LocalizedText } from "~/lib/i18n/localized";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ModelCheckboxes } from "~/components/admin/TeacherModelForm";
import { ChoiceSelect } from "./selects";

/** What the instance lets a team choose (`getTeamSettingsOffer`). */
export interface TeamOffer {
  features: { id: string; name: LocalizedText }[];
  tools: { slug: string; name: LocalizedText }[];
  models: { id: string; displayName: string }[];
}

/**
 * A team's choices (P28.3), for the admin and the team lead alike: per part and per tool
 * on, off or no choice, and the team's models (follows the instance, or an own set within
 * it). Two forms that save themselves, both with intent `settings`; each posts only its
 * own fields, so the other half is left alone. Only what the instance has not Off is shown.
 */
export function TeamSettingsForm({
  idPrefix,
  settings,
  offer,
  hidden,
  errorMessage,
}: {
  idPrefix: string;
  settings: TeamSettings;
  offer: TeamOffer;
  hidden?: Record<string, string>;
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const f = t.features;
  const [mode, setMode] = useState<"inherit" | "own">(settings.models ? "own" : "inherit");

  const row = (key: string, name: LocalizedText, choice: TeamSettings["tools"][string]) => {
    const label = loc(name, locale);
    return (
      <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <ChoiceSelect
          name={key}
          label={fmt(f.choiceLabel, { name: label })}
          defaultValue={choice}
          noneLabel={f.choiceNone}
        />
      </li>
    );
  };

  const radio = (value: "inherit" | "own", label: string) => (
    <div className="flex items-center gap-2.5">
      <input
        type="radio"
        id={`${idPrefix}-models-${value}`}
        name="modelMode"
        value={value}
        defaultChecked={(settings.models ? "own" : "inherit") === value}
        onChange={() => setMode(value)}
        className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
      />
      <label htmlFor={`${idPrefix}-models-${value}`} className="text-sm font-medium text-slate-800">
        {label}
      </label>
    </div>
  );

  return (
    <div className="space-y-4">
      <AutoSaveForm intent="settings" hidden={hidden} errorMessage={errorMessage}>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">{f.featuresHeading}</legend>
          <ul className="mt-1 divide-y divide-slate-100">
            {offer.features.map((x) => row(`feature:${x.id}`, x.name, settings.features[x.id]))}
          </ul>
        </fieldset>
        {offer.tools.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              {f.toolsLabel} ({offer.tools.length})
            </summary>
            <ul className="mt-1 divide-y divide-slate-100">
              {offer.tools.map((x) => row(`tool:${x.slug}`, x.name, settings.tools[x.slug]))}
            </ul>
          </details>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        intent="settings"
        hidden={hidden}
        errorMessage={errorMessage}
        onReset={() => setMode(settings.models ? "own" : "inherit")}
      >
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">{f.modelsLegend}</legend>
          <p className="mt-1 text-xs text-slate-500">{f.teamModelsHint}</p>
          <div className="mt-2 space-y-2">
            {radio("inherit", f.modelsFollow)}
            {radio("own", f.modelsOwn)}
          </div>
          <ModelCheckboxes
            idPrefix={`${idPrefix}-model`}
            base={offer.models}
            checkedIds={settings.models ?? offer.models.map((m) => m.id)}
            disabled={mode === "inherit"}
          />
        </fieldset>
      </AutoSaveForm>
    </div>
  );
}
