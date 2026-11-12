import { showsProgramme } from "~/lib/context/relevance";
import { Input } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";
import { Field } from "./Field";

/** Free text; the programmes of the teacher's teams are offered as suggestions (a datalist). */
export function ProgrammeField({
  sector,
  defaultValue,
  options = [],
}: {
  sector?: string;
  defaultValue?: string;
  options?: string[];
}) {
  const t = useT();
  if (!showsProgramme(sector)) return null;
  const listId = options.length > 0 ? "cf-programme-options" : undefined;
  return (
    <Field id="cf-programme" label={t.settings.programme}>
      <Input
        id="cf-programme"
        name="programme"
        defaultValue={defaultValue}
        placeholder={t.settings.ph.programme}
        list={listId}
        autoComplete="off"
      />
      {listId && (
        <datalist id={listId}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      )}
    </Field>
  );
}
