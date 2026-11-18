/** My own default model on /account (BESLUIT-2026-11-18-4). Saves itself; the toast reports. */
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { Card, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

export function DefaultModelCard({
  current,
  options,
}: {
  current: string | null;
  options: { id: string; displayName: string }[];
}) {
  const a = useT().account;
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold text-slate-900">{a.defaultModelHeading}</h2>
      <p className="mt-1 text-sm text-slate-600">{a.defaultModelIntro}</p>
      <AutoSaveForm intent="defaultModel" className="mt-4 max-w-md">
        <Label htmlFor="own-default-model">{a.defaultModelLabel}</Label>
        <Select
          id="own-default-model"
          name="defaultModel"
          defaultValue={current ?? ""}
          className="mt-1"
        >
          <option value="">{a.defaultModelNone}</option>
          {options.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </Select>
      </AutoSaveForm>
    </Card>
  );
}
