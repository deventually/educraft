import { useId } from "react";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Label, Select } from "~/components/ui";
import { useT } from "~/lib/i18n/useT";

/**
 * "Cursus overdragen" (BESLUIT-2026-11-10-5): the owner hands the course to a colleague, who
 * becomes owner at once. The old owner stays on as editor unless they untick it.
 */
export function CourseTransfer({ to }: { to: { userId: string; name: string }[] }) {
  const t = useT();
  const e = t.courseMembers;
  const id = useId();
  return (
    <ConfirmDialog
      triggerLabel={e.transfer}
      triggerVariant="secondary"
      title={e.transfer}
      description={e.transferIntro}
      confirmLabel={e.transferSubmit}
      confirmVariant="primary"
      cancelLabel={t.confirm.cancel}
      fields={{ intent: "transfer-course" }}
    >
      <div>
        <Label htmlFor={`${id}-to`}>{e.transferTo}</Label>
        <Select id={`${id}-to`} name="userId" required className="mt-1" data-autofocus>
          {to.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="keepAsEditor" defaultChecked className="size-4" />
        {e.transferKeep}
      </label>
    </ConfirmDialog>
  );
}
