import { useId } from "react";
import { Label, Select } from "~/components/ui";
import { AddDialog } from "~/components/connections/AddDialog";
import { ConnectionList } from "~/components/connections/ConnectionList";
import { RoleForm } from "./RoleForm";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

type MemberRole = "editor" | "co-owner";
const ROLES: MemberRole[] = ["editor", "co-owner"];

export interface CourseTeamsProps {
  manages: boolean;
  /** Teams linked to the course, with their members' names. */
  teams: { id: string; name: string; role: MemberRole; members: string[] }[];
  /** The manager's own teams that can still be linked. */
  teamCandidates: { id: string; name: string }[];
}

/**
 * "Teams die meewerken" (BESLUIT-2026-11-16-2): a manager adds whole teams, such as module
 * teams, as editors or co-owners with Team toevoegen, changes a role in the row, and Weghalen
 * asks first (plan step 6). Everyone in a linked
 * team works on the course for as long as they are in it. An editor only sees the teams.
 */
export function CourseTeams({ manages, teams, teamCandidates }: CourseTeamsProps) {
  const t = useT();
  const e = t.courseMembers;
  const id = useId();
  if (!manages && teams.length === 0) return null;

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
    <ConnectionList
      headingLevel={3}
      title={e.teamsHeading}
      intro={manages ? e.teamsIntro : undefined}
      empty={e.teamsEmpty}
      add={
        manages &&
        teamCandidates.length > 0 && (
          <AddDialog
            triggerLabel={e.teamLink}
            title={e.addTeamsTitle}
            intent="link-teams"
            pick={{
              name: "teamId",
              options: teamCandidates.map((team) => ({ id: team.id, label: team.name })),
              empty: e.teamNoCandidates,
            }}
          >
            <div className="max-w-xs">
              <Label htmlFor={`${id}-team-role`}>{e.teamRole}</Label>
              {roleSelect(`${id}-team-role`, "editor")}
            </div>
          </AddDialog>
        )
      }
      items={teams.map((team) => ({
        id: team.id,
        name: team.name,
        meta: `${manages ? "" : `${e.roles[team.role]} · `}${
          team.members.length ? team.members.join(", ") : e.teamNobody
        }`,
        actions: manages && (
          <RoleForm
            intent="link-team"
            field={{ teamId: team.id }}
            name={team.name}
            select={roleSelect(
              `${id}-role-${team.id}`,
              team.role,
              fmt(e.roleLabel, { name: team.name }),
            )}
          />
        ),
        remove: manages
          ? {
              fields: { intent: "unlink-team", teamId: team.id },
              title: fmt(e.removeTitle, { name: team.name }),
              description: e.teamRemoveBody,
            }
          : undefined,
      }))}
    />
  );
}
