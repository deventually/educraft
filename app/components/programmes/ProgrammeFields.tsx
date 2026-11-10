import { Input, Label, Select } from "~/components/ui";
import { PROGRAMME_FORMS, PROGRAMME_LIMITS } from "~/lib/programmes/schema";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";

export interface KindOption {
  value: string;
  label: string;
}

/** Name, type and level, and mode: the fields of a new programme and of its settings. */
export function ProgrammeFields({
  id,
  kinds,
  defaults,
}: {
  id: string;
  kinds: KindOption[];
  defaults?: { name: string; kind: string; form: string };
}) {
  const p = useT().programmes;
  const locale = useLocale();
  return (
    <>
      <div>
        <Label htmlFor={`${id}-name`}>{p.name}</Label>
        <Input
          id={`${id}-name`}
          name="name"
          required
          maxLength={PROGRAMME_LIMITS.name}
          placeholder={p.namePlaceholder}
          defaultValue={defaults?.name}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${id}-kind`}>{p.kind}</Label>
        <Select id={`${id}-kind`} name="kind" defaultValue={defaults?.kind} className="mt-1">
          {kinds.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`${id}-form`}>{p.form}</Label>
        <Select id={`${id}-form`} name="form" defaultValue={defaults?.form ?? ""} className="mt-1">
          <option value="">{p.formNone}</option>
          {PROGRAMME_FORMS.map((f) => (
            <option key={f.value} value={f.value}>
              {loc(f.label, locale)}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
