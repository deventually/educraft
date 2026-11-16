import { Form } from "react-router";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import type { AddOption } from "~/components/connections/AddDialog";
import { ProgrammeFields } from "~/components/programmes/ProgrammeFields";
import { ProgrammeTeams } from "~/components/programmes/ProgrammeTeams";
import { Button, Card, Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/**
 * The Gegevens tab of a programme (plan step 4): its details with one Opslaan (an admin also
 * chooses the faculty here), its teams, and at the bottom Opleiding verwijderen for an admin.
 */
export function ProgrammeDetails({
  id,
  programme,
  kinds,
  teamOptions,
  myTeamIds,
  isAdmin,
  canDelete,
  divisions,
  divisionWord,
}: {
  id: string;
  programme: {
    name: string;
    kind: string;
    form: string;
    canManage: boolean;
    divisionId?: string | null;
    teams: { id: string; name: string }[];
  };
  kinds: { value: string; label: string }[];
  teamOptions: AddOption[];
  myTeamIds: string[];
  isAdmin: boolean;
  canDelete: boolean;
  divisions: { id: string; name: string }[];
  divisionWord?: string;
}) {
  const t = useT();
  const p = t.programmes;
  return (
    <div className="space-y-10">
      {programme.canManage && (
        <section aria-labelledby={`${id}-settings`}>
          <h2 id={`${id}-settings`} className="text-lg font-medium text-slate-900">
            {p.settingsTitle}
          </h2>
          <Card className="mt-3 p-4">
            <Form method="post" className="grid gap-4 sm:grid-cols-3">
              <input type="hidden" name="intent" value="settings" />
              <ProgrammeFields
                id={`${id}-settings`}
                kinds={kinds}
                defaults={{ name: programme.name, kind: programme.kind, form: programme.form }}
              />
              {isAdmin && divisions.length > 0 && (
                <div>
                  <Label htmlFor={`${id}-division`}>{divisionWord ?? p.division}</Label>
                  <Select
                    id={`${id}-division`}
                    name="divisionId"
                    defaultValue={programme.divisionId ?? ""}
                    className="mt-1"
                  >
                    <option value="">{t.organisation.noneOption}</option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="sm:col-span-3">
                <Button type="submit" size="sm" variant="secondary">
                  {p.save}
                </Button>
              </div>
            </Form>
          </Card>
        </section>
      )}

      <ProgrammeTeams
        programme={programme}
        teamOptions={teamOptions}
        myTeamIds={myTeamIds}
        isAdmin={isAdmin}
      />

      {canDelete && (
        <section className="border-t border-slate-200 pt-6">
          <ConfirmDialog
            triggerLabel={p.deleteProgramme}
            title={p.deleteTitle}
            description={p.deleteBody}
            confirmLabel={p.delete}
            cancelLabel={t.confirm.cancel}
            fields={{ intent: "delete" }}
          />
        </section>
      )}
    </div>
  );
}
