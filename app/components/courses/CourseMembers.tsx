import { useId } from "react";
import { Form } from "react-router";
import { Users } from "lucide-react";
import { Button, Card, Label, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

type MemberRole = "editor" | "co-owner";

interface Member {
  userId: string;
  name: string;
  role: MemberRole;
}

export interface CourseMembersProps {
  /** The viewer's own role on the course. */
  myRole: "owner" | MemberRole;
  ownerName: string;
  members: Member[];
  /** Team-mates a manager can still add. */
  candidates: { userId: string; name: string }[];
}

const ROLES: MemberRole[] = ["editor", "co-owner"];

/**
 * "Samen aan deze cursus werken" (BESLUIT-2026-11-10-3): the owner and co-owners add
 * team-mates as editor or co-owner, change a role and remove someone; an editor sees who
 * works on the course. Every member can stop.
 */
export function CourseMembers({ myRole, ownerName, members, candidates }: CourseMembersProps) {
  const t = useT();
  const e = t.courseMembers;
  const id = useId();
  const manages = myRole !== "editor";

  const roleSelect = (selectId: string, value: MemberRole, label?: string) => (
    <Select
      id={selectId}
      name="role"
      defaultValue={value}
      aria-label={label}
      className={label ? undefined : "mt-1"}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {e.roles[r]}
        </option>
      ))}
    </Select>
  );

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 text-lg font-medium text-slate-900">
        <Users className="size-4 text-violet-600" aria-hidden />
        {e.heading}
      </h2>
      {manages && <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{e.intro}</p>}
      <Card className="mt-3 p-4">
        {myRole !== "owner" && (
          <p className="text-sm font-medium text-slate-900">{fmt(e.owner, { owner: ownerName })}</p>
        )}
        <h3 className="mt-1 text-sm font-medium text-slate-700">{e.listLabel}</h3>
        {members.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{e.empty}</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {members.map((p) => (
              <li key={p.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-900">
                  {p.name}
                  {!manages && <span className="text-slate-600"> · {e.roles[p.role]}</span>}
                </span>
                {manages && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="set-member" />
                      <input type="hidden" name="userId" value={p.userId} />
                      {roleSelect(
                        `${id}-role-${p.userId}`,
                        p.role,
                        fmt(e.roleLabel, { name: p.name }),
                      )}
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        aria-label={fmt(e.saveLabel, { name: p.name })}
                      >
                        {e.save}
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="remove-member" />
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
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {manages &&
          (candidates.length === 0 ? (
            members.length === 0 && <p className="mt-3 text-sm text-slate-600">{e.noTeammates}</p>
          ) : (
            <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="intent" value="set-member" />
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
              <div>
                <Label htmlFor={`${id}-role`}>{e.role}</Label>
                {roleSelect(`${id}-role`, "editor")}
              </div>
              <Button type="submit" size="sm" variant="secondary">
                {e.add}
              </Button>
            </Form>
          ))}

        {myRole !== "owner" && (
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
