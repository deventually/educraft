/**
 * The settings of a model the admin adds or edits: effort, temperature and three switches.
 * Shared by the add form and an added model's edit form, so both ask the same.
 */
import { Input, Label, Select } from "~/components/ui";
import { CheckField, type ModelConfig } from "~/components/admin/modelShared";
import { useT } from "~/lib/i18n/useT";

export function ModelSettingsFields({
  idPrefix,
  config,
}: {
  idPrefix: string;
  /** The current settings; absent = a new model (only "teachers may choose" on). */
  config?: ModelConfig;
}) {
  const a = useT().modelAdmin;
  const temperature = config?.settings?.temperature;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${idPrefix}-effort`}>{a.effort}</Label>
          <Select
            id={`${idPrefix}-effort`}
            name="effort"
            defaultValue={config?.settings?.effort ?? ""}
            aria-describedby={`${idPrefix}-effort-hint`}
            className="mt-1"
          >
            <option value="">{a.effortDefault}</option>
            {(["low", "medium", "high", "xhigh", "max"] as const).map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
          <p id={`${idPrefix}-effort-hint`} className="mt-1 text-xs text-slate-500">
            {a.effortHint}
          </p>
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-temperature`}>{a.temperature}</Label>
          <Input
            id={`${idPrefix}-temperature`}
            name="temperature"
            type="number"
            inputMode="decimal"
            min={0}
            max={2}
            step={0.1}
            defaultValue={temperature ?? undefined}
            aria-describedby={`${idPrefix}-temperature-hint`}
            className="mt-1"
          />
          <p id={`${idPrefix}-temperature-hint`} className="mt-1 text-xs text-slate-500">
            {a.temperatureHint}
          </p>
        </div>
      </div>
      <div className="space-y-3">
        <CheckField
          id={`${idPrefix}-images`}
          name="supportsImages"
          label={a.supportsImages}
          defaultChecked={config?.supportsImages}
        />
        <CheckField
          id={`${idPrefix}-thinks`}
          name="alwaysThinks"
          label={a.alwaysThinks}
          hint={a.alwaysThinksHint}
          defaultChecked={config?.alwaysThinks}
        />
        <CheckField
          id={`${idPrefix}-selectable`}
          name="clientSelectable"
          label={a.clientSelectable}
          hint={a.clientSelectableHint}
          defaultChecked={config?.clientSelectable ?? true}
        />
      </div>
    </>
  );
}
