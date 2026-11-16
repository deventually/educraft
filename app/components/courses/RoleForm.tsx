import { Form } from "react-router";
import { Button } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

/** A role select with its own Opslaan, in a member's or a team's row. */
export function RoleForm({
  intent,
  field,
  name,
  select,
}: {
  intent: string;
  field: Record<string, string>;
  name: string;
  select: React.ReactNode;
}) {
  const e = useT().courseMembers;
  return (
    <Form method="post" className="flex items-center gap-2">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(field).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {select}
      <Button type="submit" size="sm" variant="secondary" aria-label={fmt(e.saveLabel, { name })}>
        {e.save}
      </Button>
    </Form>
  );
}
