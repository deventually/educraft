import { useId } from "react";
import { Form } from "react-router";
import { Button, Label, Select } from "~/components/ui";
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
 * "Teams die meewerken" (BESLUIT-2026-11-16-2): a manager links a whole team, such as a
 * module team, as editors or co-owners, changes its role or unlinks it. Everyone in a linked
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
    <div className="mt-4 border-t border-slate-100 pt-3">
      <h3 id={id} className="text-sm font-medium text-slate-700">
        {e.teamsHeading}
      </h3>
      {manages && <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{e.teamsIntro}</p>}
      {teams.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">{e.teamsEmpty}</p>
      ) : (
        <ul aria-labelledby={id} className="mt-1 divide-y divide-slate-100">
          {teams.map((team) => (
            <li key={team.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-900">
                  {manages ? team.name : `${team.name} · ${e.roles[team.role]}`}
                </span>
                {manages && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Form method="post" className="flex items-center gap-2">
                      <input type="hidden" name="intent" value="link-team" />
                      <input type="hidden" name="teamId" value={team.id} />
                      {roleSelect(
                        `${id}-role-${team.id}`,
                        team.role,
                        fmt(e.roleLabel, { name: team.name }),
                      )}
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        aria-label={fmt(e.saveLabel, { name: team.name })}
                      >
                        {e.save}
                      </Button>
                    </Form>
                    <Form method="post">
                      <input type="hidden" name="intent" value="unlink-team" />
                      <input type="hidden" name="teamId" value={team.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        aria-label={fmt(e.teamUnlinkLabel, { team: team.name })}
                      >
                        {e.teamUnlink}
                      </Button>
                    </Form>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-600">
                {team.members.length ? team.members.join(", ") : e.teamNobody}
              </p>
            </li>
          ))}
        </ul>
      )}

      {manages && teamCandidates.length > 0 && (
        <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="link-team" />
          <div>
            <Label htmlFor={`${id}-team`}>{e.teamLabel}</Label>
            <Select id={`${id}-team`} name="teamId" required defaultValue="" className="mt-1">
              <option value="" disabled>
                {e.teamNone}
              </option>
              {teamCandidates.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`${id}-team-role`}>{e.teamRole}</Label>
            {roleSelect(`${id}-team-role`, "editor")}
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {e.teamLink}
          </Button>
        </Form>
      )}
    </div>
  );
}
