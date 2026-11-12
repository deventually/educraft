import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { HelpText, Label, Select } from "~/components/ui";

/**
 * Where a team belongs (admin team page): under one of the institution's divisions, or under
 * none (the whole institution). A team of a programme belongs where its programme does; this is
 * for a team without one, such as an exam board. Saves itself.
 */
export function TeamDivisionForm({
  divisions,
  divisionId,
  divisionWord,
  errorMessage,
}: {
  divisions: { id: string; name: string }[];
  divisionId: string | null;
  divisionWord: string;
  errorMessage: (code: string | true) => string | undefined;
}) {
  const tt = useT().teams;
  return (
    <AutoSaveForm intent="division" errorMessage={errorMessage} className="max-w-sm">
      <Label htmlFor="team-division">
        {fmt(tt.divisionLabel, { kind: divisionWord.toLowerCase() })}
      </Label>
      <Select
        id="team-division"
        name="divisionId"
        defaultValue={divisionId ?? ""}
        aria-describedby="team-division-hint"
        className="mt-1"
      >
        <option value="">{tt.divisionNone}</option>
        {divisions.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </Select>
      <HelpText id="team-division-hint">{tt.divisionHint}</HelpText>
    </AutoSaveForm>
  );
}
