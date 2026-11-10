import { useId } from "react";
import { Form } from "react-router";
import { Users } from "lucide-react";
import { Button, Card, Label, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

interface Person {
  userId: string;
  name: string;
}

export interface CourseEditorsProps {
  isOwner: boolean;
  ownerName: string;
  editors: Person[];
  /** Team-mates the owner can still add. */
  candidates: Person[];
}

/**
 * "Samen aan deze cursus werken" (BESLUIT-2026-11-10-3): the owner chooses editors among
 * team-mates and removes them; an editor sees who works on the course and can stop.
 */
export function CourseEditors({ isOwner, ownerName, editors, candidates }: CourseEditorsProps) {
  const t = useT();
  const e = t.courseEditors;
  const id = useId();

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 text-lg font-medium text-slate-900">
        <Users className="size-4 text-violet-600" aria-hidden />
        {e.heading}
      </h2>
      {isOwner && <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{e.intro}</p>}
      <Card className="mt-3 p-4">
        {!isOwner && (
          <p className="text-sm font-medium text-slate-900">{fmt(e.owner, { owner: ownerName })}</p>
        )}
        <h3 className="mt-1 text-sm font-medium text-slate-700">{e.listLabel}</h3>
        {editors.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{e.empty}</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {editors.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-900">{p.name}</span>
                {isOwner && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="remove-editor" />
                    <input type="hidden" name="userId" value={p.userId} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="ghost"
                      aria-label={fmt(e.removeLabel, { name: p.name })}
                    >
                      {e.remove}
                    </Button>
                  </Form>
                )}
              </li>
            ))}
          </ul>
        )}

        {isOwner &&
          (candidates.length === 0 ? (
            editors.length === 0 && <p className="mt-3 text-sm text-slate-600">{e.noTeammates}</p>
          ) : (
            <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="add-editor" />
              <div>
                <Label htmlFor={`${id}-who`}>{e.addLabel}</Label>
                <Select id={`${id}-who`} name="userId" required defaultValue="" className="mt-1">
                  <option value="" disabled>
                    {e.addNone}
                  </option>
                  {candidates.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" size="sm" variant="secondary">
                {e.add}
              </Button>
            </Form>
          ))}

        {!isOwner && (
          <div className="mt-3">
            <ConfirmDialog
              triggerLabel={e.leave}
              triggerVariant="secondary"
              title={e.leave}
              description={e.leaveConfirm}
              confirmLabel={e.leave}
              cancelLabel={t.confirm.cancel}
              fields={{ intent: "leave-course" }}
            />
          </div>
        )}
      </Card>
    </section>
  );
}
