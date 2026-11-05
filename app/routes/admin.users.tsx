import { useState } from "react";
import { Form, Link, useActionData } from "react-router";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import type { Route } from "./+types/admin.users";
import { isOwner, requireRole } from "~/server/auth.server";
import { NO_PASSWORD, hashPassword } from "~/server/password.server";
import {
  createInvite,
  createPasswordReset,
  createUser,
  getUserByEmail,
  getUserById,
  listPeople,
  revokeInvite,
} from "~/server/repositories/users.server";
import { getOwnerUserId } from "~/server/repositories/settings.server";
import {
  getTeamWithMembers,
  joinTeamFromInvite,
  listTeams,
} from "~/server/repositories/teams.server";
import { MIN_PASSWORD_LENGTH, SET_PASSWORD_LINK_DAYS } from "~/server/userAdmin.server";
import { ROLES, isRole } from "~/lib/registry/access";
import { useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { CreateAccountForm, type CreateAccountResult } from "~/components/admin/CreateAccountForm";
import { CopyButton, LinkCard } from "~/components/admin/LinkCard";
import { LastActive, OwnerBadge, StatusBadge, roleLabel } from "~/components/admin/people";

const STATUSES = ["active", "invited", "disabled"] as const;

/** The list's search and filters, from the query string; an unknown value means "all". */
const FilterSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  role: z.enum(ROLES).or(z.literal("")).catch(""),
  status: z.enum(STATUSES).or(z.literal("")).catch(""),
  team: z.string().max(64).catch(""),
});

/**
 * The user list (P28.1): one row per person (accounts and open invites), searched and
 * filtered on the server, and one "Add" button. Everything about one person lives on
 * their own page (`/admin/users/:id`).
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const url = new URL(request.url);
  const filter = FilterSchema.parse({
    q: url.searchParams.get("q") ?? "",
    role: url.searchParams.get("role") ?? "",
    status: url.searchParams.get("status") ?? "",
    team: url.searchParams.get("team") ?? "",
  });
  const [rows, storedOwnerId, viewerIsOwner, allTeams] = await Promise.all([
    listPeople({
      q: filter.q || undefined,
      role: filter.role || undefined,
      status: filter.status || undefined,
      teamId: filter.team || undefined,
    }),
    getOwnerUserId(),
    isOwner(admin),
    listTeams(),
  ]);
  // The badge is for every admin to see; a stored id of a demoted or deleted account
  // counts as "no owner".
  const owner = storedOwnerId ? await getUserById(storedOwnerId) : null;
  return {
    selfId: admin.id,
    isOwner: viewerIsOwner,
    ownerId: owner?.role === "admin" ? owner.id : null,
    filter,
    teams: allTeams.map((t) => ({ id: t.id, name: t.name })),
    people: rows.map((r) => ({
      kind: r.kind,
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      lastActiveDay: r.lastActiveDay,
      // An open invite's link, to copy again (an admin already sees every invite).
      ...(r.kind === "invite" ? { link: `${url.origin}/invite/${r.id}` } : {}),
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  // Authority is decided here, on the server, for every intent below; the page only hides.
  const actorIsOwner = await isOwner(admin);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  // The team a new person joins (P28.2); an unknown id means none.
  const teamId = String(fd.get("teamId") ?? "");
  const team = teamId ? await getTeamWithMembers(teamId) : null;

  if (intent === "mint") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "14") || 14));
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    const invite = await createInvite({
      role: "teacher", // admins are never minted by invite
      note,
      expiresAt,
      createdByUserId: admin.id,
      teamId: team?.id ?? null,
    });
    return { link: `${new URL(request.url).origin}/invite/${invite.token}` };
  }

  if (intent === "revoke") {
    await revokeInvite(String(fd.get("token") ?? ""));
    return { revoked: true as const };
  }

  // ── A direct account (P18.7, super admin only) ─────────────────────────────
  // No password is ever returned to the client; the only secret that leaves is the
  // single-use link.
  if (intent === "createAccount") {
    // Tagged so the page shows a refusal inside the create form, next to its fields.
    const fail = <E extends string>(error: E) => ({ error, form: "create" as const });
    if (!actorIsOwner) return fail("ownerOnly");
    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const role = String(fd.get("role") ?? "");
    const mode = String(fd.get("passwordMode") ?? "");
    if (!name) return fail("nameRequired");
    if (!z.string().email().safeParse(email).success) return fail("invalidEmail");
    if (!isRole(role)) return fail("invalidRole");
    if (mode !== "link" && mode !== "password") return fail("unknown");
    let passwordHash = NO_PASSWORD;
    if (mode === "password") {
      const password = String(fd.get("password") ?? "");
      const confirm = String(fd.get("confirm") ?? "");
      if (password.length < MIN_PASSWORD_LENGTH) return fail("passwordTooShort");
      if (password !== confirm) return fail("passwordMismatch");
      passwordHash = hashPassword(password);
    }
    // Reject a collision up front so the unique index never throws.
    if (await getUserByEmail(email)) return fail("emailTaken");
    const created = await createUser({ name, email, passwordHash, role });
    if (team) await joinTeamFromInvite(team.id, created.id);
    if (mode === "password") return { accountCreated: true as const };
    const reset = await createPasswordReset(created.id, SET_PASSWORD_LINK_DAYS * 24);
    return { setPasswordLink: `${new URL(request.url).origin}/reset/${reset.token}` };
  }

  // Everything about one account is on its own page now (P28.1).
  return { error: "unknown" as const };
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";

/** The team a new person joins (P28.2); only shown when there are teams. */
function TeamSelect({ teams, id }: { teams: { id: string; name: string }[]; id: string }) {
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

/** "Add": an invite link, or (super admin only) an account right away (P18.7). */
function AddPersonForm({
  viewerIsOwner,
  actionData,
  createError,
  teams,
}: {
  viewerIsOwner: boolean;
  actionData: unknown;
  createError?: string;
  teams: { id: string; name: string }[];
}) {
  const t = useT();
  const i = t.admin.invites;
  const [how, setHow] = useState<"invite" | "account">("invite");
  const radio = (value: "invite" | "account", label: string) => (
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
      <h2 className={h2}>{t.people.addHeading}</h2>
      {viewerIsOwner && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-800">{t.people.addHow}</legend>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {radio("invite", t.people.addInvite)}
            {radio("account", t.people.addAccount)}
          </div>
        </fieldset>
      )}

      {how === "account" && viewerIsOwner ? (
        <CreateAccountForm
          result={actionData as CreateAccountResult}
          errorMessage={createError}
          extraFields={<TeamSelect teams={teams} id="create-team" />}
        />
      ) : (
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
      )}
    </div>
  );
}

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  const actionData = useActionData<typeof action>();
  const { selfId, people, filter, teams, isOwner: viewerIsOwner, ownerId } = loaderData;
  const [adding, setAdding] = useState(false);

  const errors: Record<string, string> = {
    ownerOnly: i.ownerOnlyError,
    nameRequired: t.auth.nameRequired,
    invalidEmail: i.invalidEmailError,
    emailTaken: i.emailTakenError,
    invalidRole: i.invalidRoleError,
    passwordTooShort: t.auth.passwordTooShort,
    passwordMismatch: t.auth.passwordMismatch,
  };
  const actionError =
    actionData && "error" in actionData && typeof actionData.error === "string"
      ? actionData.error
      : undefined;
  const createError = actionError ? errors[actionError] : undefined;

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: errors[d.error] ?? t.error.generic }
          : {
              variant: "success",
              message:
                "setPasswordLink" in d || "accountCreated" in d
                  ? i.accountCreated
                  : t.admin.console.saved,
            },
  });

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={h2}>{p.heading}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{p.intro}</p>
          </div>
          <Button
            type="button"
            aria-expanded={adding}
            aria-controls="add-person"
            onClick={() => setAdding((v) => !v)}
          >
            <UserPlus className="size-4" aria-hidden />
            {p.add}
          </Button>
        </div>

        {adding && (
          <AddPersonForm
            viewerIsOwner={viewerIsOwner}
            actionData={actionData}
            createError={createError}
            teams={teams}
          />
        )}
      </section>

      {/* ── Search and filters: a plain GET form, the loader filters ─────────── */}
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

      {people.length === 0 ? (
        <p className="text-sm text-slate-500">{p.none}</p>
      ) : (
        /* `relative`: the box is the containing block of the absolutely positioned
           sr-only labels, so they scroll with the table instead of widening the page. */
        <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{p.heading}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className={th}>
                  {p.colName}
                </th>
                <th scope="col" className={th}>
                  {p.colEmail}
                </th>
                <th scope="col" className={th}>
                  {p.colRole}
                </th>
                <th scope="col" className={th}>
                  {p.colStatus}
                </th>
                <th scope="col" className={th}>
                  {p.colLastActive}
                </th>
                <th scope="col" className={`${th} text-right`}>
                  <span className="sr-only">{p.colActions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr
                  key={`${person.kind}-${person.id}`}
                  className="border-b border-slate-50 align-top last:border-0"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                    {person.kind === "user" ? (
                      <Link
                        to={`/admin/users/${person.id}`}
                        className="rounded text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        {person.name || person.email || person.id}
                      </Link>
                    ) : (
                      (person.name ?? i.linkOnly)
                    )}
                    {person.id === selfId && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">({i.you})</span>
                    )}
                    {person.kind === "user" && person.id === ownerId && <OwnerBadge />}
                  </th>
                  <td className={td}>{person.email ?? "—"}</td>
                  <td className={td}>{roleLabel(t, person.role)}</td>
                  <td className={td}>
                    <StatusBadge status={person.status} />
                  </td>
                  <td className={td}>
                    {person.kind === "user" ? <LastActive day={person.lastActiveDay} /> : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {person.kind === "invite" && person.link && (
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <CopyButton url={person.link} label={p.copyLink} />
                        <ConfirmDialog
                          triggerLabel={i.revoke}
                          title={i.revokeTitle}
                          description={i.revokeBody}
                          confirmLabel={i.revoke}
                          cancelLabel={t.confirm.cancel}
                          fields={{ intent: "revoke", token: person.id }}
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
