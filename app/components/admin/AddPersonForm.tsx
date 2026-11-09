import { useState } from "react";
import { Form } from "react-router";
import type { PasteOutcome } from "~/lib/people/pasteList";
import { useT } from "~/lib/i18n/useT";
import { Button, Input, Label, Select } from "~/components/ui";
import { CreateAccountForm, type CreateAccountResult } from "~/components/admin/CreateAccountForm";
import { LinkCard } from "~/components/admin/LinkCard";
import { PasteListForm } from "~/components/admin/PasteListForm";

type AddHow = "invite" | "list" | "account";
type TeamOption = { id: string; name: string };

/** The team a new person joins (P28.2); only shown when there are teams. */
function TeamSelect({ teams, id }: { teams: TeamOption[]; id: string }) {
  const t = useT();
  if (teams.length === 0) return null;
  return (
    <div className="sm:w-1/2 sm:pr-2">
      <Label htmlFor={id}>{t.teams.addTeam}</Label>
      <Select id={id} name="teamId" defaultValue="" className="mt-1">
        <option value="">{t.teams.noTeam}</option>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** One invite link: an optional note, how long it stays valid, and a team. */
function InviteForm({ actionData, teams }: { actionData: unknown; teams: TeamOption[] }) {
  const t = useT();
  const i = t.admin.invites;
  return (
    <div>
      <p className="text-sm text-slate-600">{i.mintIntro}</p>
      {actionData && typeof actionData === "object" && "link" in actionData ? (
        <LinkCard
          heading={i.linkHeading}
          hint={i.linkHint}
          url={String(actionData.link)}
          copyLabel={i.copy}
        />
      ) : (
        <Form method="post" className="mt-4 max-w-xl space-y-4">
          <input type="hidden" name="intent" value="mint" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="note">{i.noteLabel}</Label>
              <Input
                id="note"
                name="note"
                type="text"
                placeholder={i.notePlaceholder}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="expiryDays">{i.expiryLabel}</Label>
              <Input
                id="expiryDays"
                name="expiryDays"
                type="number"
                min={1}
                max={90}
                defaultValue={14}
                className="mt-1"
              />
            </div>
          </div>
          <TeamSelect teams={teams} id="invite-team" />
          <Button type="submit">{i.submit}</Button>
        </Form>
      )}
    </div>
  );
}

/**
 * "Add": an invite link, a pasted list of invites (P28.5), or (super admin only) an
 * account right away (P18.7).
 */
export function AddPersonForm({
  viewerIsOwner,
  actionData,
  createError,
  teams,
}: {
  viewerIsOwner: boolean;
  actionData: unknown;
  createError?: string;
  teams: TeamOption[];
}) {
  const t = useT();
  const [how, setHow] = useState<AddHow>("invite");
  const pasted =
    actionData && typeof actionData === "object" && "pasted" in actionData
      ? (actionData.pasted as PasteOutcome[])
      : undefined;
  const radio = (value: AddHow, label: string) => (
    <div className="flex items-center gap-2">
      <input
        type="radio"
        id={`add-how-${value}`}
        name="addHow"
        value={value}
        checked={how === value}
        onChange={() => setHow(value)}
        className="size-4 border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
      />
      <label htmlFor={`add-how-${value}`} className="text-sm font-medium text-slate-800">
        {label}
      </label>
    </div>
  );

  return (
    <div
      id="add-person"
      className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {t.people.addHeading}
      </h2>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">{t.people.addHow}</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          {radio("invite", t.people.addInvite)}
          {radio("list", t.people.addList)}
          {viewerIsOwner && radio("account", t.people.addAccount)}
        </div>
      </fieldset>

      {how === "list" ? (
        <PasteListForm result={pasted} extraFields={<TeamSelect teams={teams} id="list-team" />} />
      ) : how === "account" && viewerIsOwner ? (
        <CreateAccountForm
          result={actionData as CreateAccountResult}
          errorMessage={createError}
          extraFields={<TeamSelect teams={teams} id="create-team" />}
        />
      ) : (
        <InviteForm actionData={actionData} teams={teams} />
      )}
    </div>
  );
}
