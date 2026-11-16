import { useId } from "react";
import { Users } from "lucide-react";
import { Label, Select } from "~/components/ui";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { CourseTeams, type CourseTeamsProps } from "./CourseTeams";
import { RoleForm } from "./RoleForm";
import { CourseTransfer } from "./CourseTransfer";

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
  /** Colleagues the owner can hand the course to. */
  transferTo: { userId: string; name: string }[];
  /** Teams linked to the course (BESLUIT-2026-11-16-2). */
  teams?: CourseTeamsProps["teams"];
  /** The manager's own teams that can still be linked. */
  teamCandidates?: CourseTeamsProps["teamCandidates"];
}

const ROLES: MemberRole[] = ["editor", "co-owner"];

/**
 * "Samen aan deze cursus werken" (BESLUIT-2026-11-10-5), in the fixed pattern (plan step 6):
 * the owner and co-owners add team-mates with Collega toevoegen (several at once, at one
 * role), change a role in the row and Weghalen after a question; an editor sees who works on
 * the course. Every member can stop.
 */
export function CourseMembers({
  myRole,
  ownerName,
  members,
  candidates,
  transferTo,
  teams = [],
  teamCandidates = [],
}: CourseMembersProps) {
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
    <section aria-labelledby={id} className="space-y-6">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-lg font-medium text-slate-900">
          <Users className="size-4 text-violet-600" aria-hidden />
          {e.heading}
        </h2>
        {manages && <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{e.intro}</p>}
        {myRole !== "owner" && (
          <p className="mt-2 text-sm font-medium text-slate-900">
            {fmt(e.owner, { owner: ownerName })}
          </p>
        )}
      </div>
      <ConnectionList
        headingLevel={3}
        title={e.membersHeading}
        empty={manages && candidates.length === 0 ? e.noTeammates : e.empty}
        add={
          manages &&
          candidates.length > 0 && (
            <AddDialog
              triggerLabel={e.addMember}
              title={e.addMembersTitle}
              intent="add-members"
              pick={{
                name: "userId",
                options: candidates.map((c) => ({ id: c.userId, label: c.name })),
                empty: e.noCandidates,
              }}
            >
              <div className="max-w-xs">
                <Label htmlFor={`${id}-role`}>{e.role}</Label>
                {roleSelect(`${id}-role`, "editor")}
              </div>
            </AddDialog>
          )
        }
        items={members.map((p) => ({
          id: p.userId,
          name: p.name,
          meta: manages ? undefined : e.roles[p.role],
          actions: manages && (
            <RoleForm
              intent="set-member"
              field={{ userId: p.userId }}
              name={p.name}
              select={roleSelect(
                `${id}-role-${p.userId}`,
                p.role,
                fmt(e.roleLabel, { name: p.name }),
              )}
            />
          ),
          remove: manages
            ? {
                fields: { intent: "remove-member", userId: p.userId },
                title: fmt(e.removeTitle, { name: p.name }),
                description: fmt(e.removeBody, { name: p.name }),
              }
            : undefined,
        }))}
      />

      <CourseTeams manages={manages} teams={teams} teamCandidates={teamCandidates} />

      {myRole === "owner" && transferTo.length > 0 && <CourseTransfer to={transferTo} />}

      {myRole !== "owner" && (
        <ConfirmDialog
          triggerLabel={e.leave}
          triggerVariant="secondary"
          title={e.leave}
          description={e.leaveConfirm}
          confirmLabel={e.leave}
          cancelLabel={t.confirm.cancel}
          fields={{ intent: "leave-course" }}
        />
      )}
    </section>
  );
}
