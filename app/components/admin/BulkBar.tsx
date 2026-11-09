import { useState } from "react";
import { Form } from "react-router";
import type { BulkAction } from "~/lib/people/bulk";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { Button, Label, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";

/**
 * "With selected": one action for every ticked person. The tick boxes live in the table
 * and join this form through `form="bulk-form"`, so it works without JS too.
 */
export function BulkBar({
  selectedIds,
  actions,
  teams,
}: {
  selectedIds: string[];
  actions: BulkAction[];
  teams: { id: string; name: string }[];
}) {
  const t = useT();
  const p = t.people;
  const label: Record<BulkAction, string> = {
    addTeam: p.bulkAddTeam,
    removeTeam: p.bulkRemoveTeam,
    deactivate: p.bulkDeactivate,
    reactivate: p.bulkReactivate,
  };
  const [action, setAction] = useState<BulkAction>(actions[0] ?? "deactivate");
  const needsTeam = action === "addTeam" || action === "removeTeam";
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <Form
        id="bulk-form"
        method="post"
        aria-label={p.bulkHeading}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="intent" value="bulk" />
        <p className="self-center text-sm font-semibold text-slate-800">
          {p.bulkHeading}
          <span className="ml-2 font-normal text-slate-600">
            {fmt(p.bulkSelected, { count: String(selectedIds.length) })}
          </span>
        </p>
        <div>
          <Label htmlFor="bulk-action">{p.bulkAction}</Label>
          <Select
            id="bulk-action"
            name="action"
            value={action}
            onChange={(e) => setAction(e.target.value as BulkAction)}
            className="mt-1 w-auto"
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {label[a]}
              </option>
            ))}
          </Select>
        </div>
        {needsTeam && (
          <div>
            <Label htmlFor="bulk-team">{p.bulkTeam}</Label>
            <Select id="bulk-team" name="teamId" className="mt-1 w-auto">
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        {action !== "deactivate" && (
          <Button type="submit" variant="secondary">
            {p.bulkApply}
          </Button>
        )}
      </Form>
      {/* Deactivating logs people out everywhere: ask first. The dialog posts its own
          form (forms may not nest), carrying the ticked ids. */}
      {action === "deactivate" && (
        <ConfirmDialog
          triggerLabel={p.bulkApply}
          triggerVariant="secondary"
          triggerSize="md"
          title={fmt(p.bulkDeactivateTitle, { count: String(selectedIds.length) })}
          description={p.bulkDeactivateBody}
          confirmLabel={p.bulkDeactivate}
          cancelLabel={t.confirm.cancel}
          fields={{ intent: "bulk", action: "deactivate" }}
        >
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="userIds" value={id} />
          ))}
        </ConfirmDialog>
      )}
    </div>
  );
}
