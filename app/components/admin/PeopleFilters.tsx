import { Form } from "react-router";
import { ROLES } from "~/lib/registry/access";
import { useT } from "~/lib/i18n/useT";
import { Button, Input, Label, Select } from "~/components/ui";
import { roleLabel } from "~/components/admin/people";

/** Search and filters on the user list: a plain GET form, the loader filters (P28.1). */
export function PeopleFilters({
  filter,
  teams,
}: {
  filter: { q: string; role: string; status: string; team: string };
  teams: { id: string; name: string }[];
}) {
  const t = useT();
  const p = t.people;
  return (
    <Form
      method="get"
      role="search"
      aria-label={p.searchRegion}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-48 flex-1">
        <Label htmlFor="people-q">{p.search}</Label>
        <Input id="people-q" name="q" type="search" defaultValue={filter.q} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="people-role">{p.filterRole}</Label>
        <Select id="people-role" name="role" defaultValue={filter.role} className="mt-1 w-auto">
          <option value="">{p.all}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(t, r)}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="people-status">{p.filterStatus}</Label>
        <Select
          id="people-status"
          name="status"
          defaultValue={filter.status}
          className="mt-1 w-auto"
        >
          <option value="">{p.all}</option>
          <option value="active">{p.statusActive}</option>
          <option value="invited">{p.statusInvited}</option>
          <option value="disabled">{p.statusDisabled}</option>
        </Select>
      </div>
      {teams.length > 0 && (
        <div>
          <Label htmlFor="people-team">{t.teams.filterTeam}</Label>
          <Select id="people-team" name="team" defaultValue={filter.team} className="mt-1 w-auto">
            <option value="">{p.all}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <Button type="submit" variant="secondary">
        {p.filterSubmit}
      </Button>
    </Form>
  );
}
