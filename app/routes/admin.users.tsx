import { useEffect, useState } from "react";
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
  findClaimedEmails,
  getUserByEmail,
  getUserById,
  listPeople,
  revokeInvite,
  setUserDisabled,
} from "~/server/repositories/users.server";
import { getOwnerUserId } from "~/server/repositories/settings.server";
import {
  addMember,
  getTeamWithMembers,
  joinTeamFromInvite,
  listTeams,
  removeMember,
} from "~/server/repositories/teams.server";
import { MIN_PASSWORD_LENGTH, SET_PASSWORD_LINK_DAYS, mayManage } from "~/server/userAdmin.server";
import { ROLES, isRole } from "~/lib/registry/access";
import { type PasteOutcome, type PasteReason, parsePastedPeople } from "~/lib/people/pasteList";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Button, Input, Label, Select } from "~/components/ui";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { CreateAccountForm, type CreateAccountResult } from "~/components/admin/CreateAccountForm";
import { CopyButton, LinkCard } from "~/components/admin/LinkCard";
import { PasteListForm } from "~/components/admin/PasteListForm";
import { LastActive, OwnerBadge, StatusBadge, roleLabel } from "~/components/admin/people";

const STATUSES = ["active", "invited", "disabled"] as const;

/** What "With selected" can do; deactivate and reactivate are for the super admin only. */
const BULK_ACTIONS = ["addTeam", "removeTeam", "deactivate", "reactivate"] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];
const OWNER_ONLY_BULK: readonly BulkAction[] = ["deactivate", "reactivate"];
/** The most people one bulk change may carry (the list shows at most 500). */
const MAX_BULK = 500;

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

  const expiryDays = Math.min(90, Math.max(1, Number(fd.get("expiryDays") ?? "14") || 14));
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  if (intent === "mint") {
    const note = String(fd.get("note") ?? "").trim() || null;
    const invite = await createInvite({
      role: "teacher", // admins are never minted by invite
      note,
      expiresAt,
      createdByUserId: admin.id,
      teamId: team?.id ?? null,
    });
    return { link: `${new URL(request.url).origin}/invite/${invite.token}` };
  }

  // ── A pasted list (P28.5): one invite link per person, or the reason why not ──
  // Every line is judged on its own; a refused line never stops the others. There is no
  // mail service: the admin passes each link on themselves.
  if (intent === "mintList") {
    const text = String(fd.get("people") ?? "").slice(0, 100_000);
    const parsed = parsePastedPeople(text);
    if (parsed.length === 0) return { error: "emptyList" as const };
    const claimed = await findClaimedEmails(parsed.flatMap((r) => (r.ok ? [r.email] : [])));
    const origin = new URL(request.url).origin;
    const pasted: PasteOutcome[] = [];
    for (const row of parsed) {
      if (!row.ok) {
        pasted.push({ line: row.line, text: row.text, reason: row.reason });
        continue;
      }
      const clash: PasteReason | null = claimed.taken.has(row.email)
        ? "emailTaken"
        : claimed.invited.has(row.email)
          ? "alreadyInvited"
          : null;
      if (clash) {
        pasted.push({ line: row.line, text: row.text, reason: clash });
        continue;
      }
      const invite = await createInvite({
        role: "teacher", // admins are never minted by invite
        note: `${row.name} <${row.email}>`,
        expiresAt,
        createdByUserId: admin.id,
        teamId: team?.id ?? null,
      });
      pasted.push({
        line: row.line,
        name: row.name,
        email: row.email,
        link: `${origin}/invite/${invite.token}`,
      });
    }
    return { pasted };
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
      passwordHash = await hashPassword(password);
    }
    // Reject a collision up front so the unique index never throws.
    if (await getUserByEmail(email)) return fail("emailTaken");
    const created = await createUser({ name, email, passwordHash, role });
    if (team) await joinTeamFromInvite(team.id, created.id);
    if (mode === "password") return { accountCreated: true as const };
    const reset = await createPasswordReset(created.id, SET_PASSWORD_LINK_DAYS * 24);
    return { setPasswordLink: `${new URL(request.url).origin}/reset/${reset.token}` };
  }

  // ── Change many people at once ("With selected") ─────────────────────────
  // Per person the same authority as on the person page: `mayManage` for teams, the
  // super admin for (de)activation, never on yourself. Who is out of reach is skipped
  // and counted, never an error for the whole batch.
  if (intent === "bulk") {
    const action = String(fd.get("action") ?? "") as BulkAction;
    if (!BULK_ACTIONS.includes(action)) return { error: "unknown" as const };
    if (OWNER_ONLY_BULK.includes(action) && !actorIsOwner) return { error: "ownerOnly" as const };
    const ids = [...new Set(fd.getAll("userIds").map(String))].slice(0, MAX_BULK);
    if (ids.length === 0) return { error: "noneSelected" as const };
    const isTeamAction = action === "addTeam" || action === "removeTeam";
    const bulkTeamId = team?.id;
    if (isTeamAction && !bulkTeamId) return { error: "teamRequired" as const };
    let done = 0;
    for (const id of ids) {
      const target = await getUserById(id);
      if (!target || !isRole(target.role)) continue;
      if (isTeamAction) {
        if (!mayManage(actorIsOwner, target)) continue;
        if (!bulkTeamId) continue;
        if (action === "addTeam") await addMember(bulkTeamId, target.id);
        else await removeMember(bulkTeamId, target.id);
      } else {
        if (target.id === admin.id) continue;
        await setUserDisabled(target.id, action === "deactivate");
      }
      done++;
    }
    return { bulk: { done, skipped: ids.length - done } };
  }

  // Everything about one account is on its own page now (P28.1).
  return { error: "unknown" as const };
}

type AddHow = "invite" | "list" | "account";

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const th = "px-4 py-2.5 font-semibold";
const td = "px-4 py-2.5 text-slate-600";
const tick =
  "size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";

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

/**
 * "Add": an invite link, a pasted list of invites (P28.5), or (super admin only) an
 * account right away (P18.7).
 */
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
      <h2 className={h2}>{t.people.addHeading}</h2>
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

/**
 * "With selected": one action for every ticked person. The tick boxes live in the table
 * and join this form through `form="bulk-form"`, so it works without JS too.
 */
function BulkBar({
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
  const [action, setAction] = useState<BulkAction>(actions[0]);
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

export default function AdminUsers({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  const actionData = useActionData<typeof action>();
  const { selfId, people, filter, teams, isOwner: viewerIsOwner, ownerId } = loaderData;
  const [adding, setAdding] = useState(false);
  // The ticked accounts for "With selected"; cleared after a bulk change.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Team actions need a team; (de)activation is the super admin's. Nothing to do: no bar.
  const bulkActions = BULK_ACTIONS.filter((a) =>
    OWNER_ONLY_BULK.includes(a) ? viewerIsOwner : teams.length > 0,
  );
  const canBulk = bulkActions.length > 0;
  const accountIds = people.filter((x) => x.kind === "user").map((x) => x.id);
  const allTicked = accountIds.length > 0 && accountIds.every((id) => selected.has(id));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  useEffect(() => {
    if (actionData && "bulk" in actionData) setSelected(new Set());
  }, [actionData]);

  const errors: Record<string, string> = {
    ownerOnly: i.ownerOnlyError,
    nameRequired: t.auth.nameRequired,
    invalidEmail: i.invalidEmailError,
    emailTaken: i.emailTakenError,
    invalidRole: i.invalidRoleError,
    passwordTooShort: t.auth.passwordTooShort,
    passwordMismatch: t.auth.passwordMismatch,
    noneSelected: p.bulkNoneSelected,
    teamRequired: p.bulkTeamRequired,
    emptyList: p.listEmpty,
  };
  const actionError =
    actionData && "error" in actionData && typeof actionData.error === "string"
      ? actionData.error
      : undefined;
  const createError = actionError ? errors[actionError] : undefined;

  // The count of a pasted list; the table itself shows who got what (P28.5).
  const pastedToast = (rows: PasteOutcome[]) => {
    const made = rows.filter((r) => "link" in r).length;
    const refused = rows.length - made;
    return {
      variant: refused ? ("info" as const) : ("success" as const),
      message: fmt(made === 1 ? p.listSummary : p.listSummaryMany, {
        made: String(made),
        refused: String(refused),
      }),
    };
  };

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: errors[d.error] ?? t.error.generic }
          : "pasted" in d && d.pasted
            ? pastedToast(d.pasted)
            : "bulk" in d && d.bulk
              ? {
                  variant: d.bulk.skipped ? "info" : "success",
                  message: fmt(d.bulk.skipped ? p.bulkSkipped : p.bulkDone, {
                    done: String(d.bulk.done),
                    skipped: String(d.bulk.skipped),
                  }),
                }
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
        <div className="space-y-3">
          {canBulk && (
            <BulkBar
              selectedIds={accountIds.filter((id) => selected.has(id))}
              actions={bulkActions}
              teams={teams}
            />
          )}
          {/* `relative`: the box is the containing block of the absolutely positioned
           sr-only labels, so they scroll with the table instead of widening the page. */}
          <div className="relative overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{p.heading}</caption>
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canBulk && (
                    <th scope="col" className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={allTicked}
                        onChange={() => setSelected(allTicked ? new Set() : new Set(accountIds))}
                        aria-label={p.selectAll}
                        className={tick}
                      />
                    </th>
                  )}
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
                    {canBulk && (
                      <td className="px-4 py-2.5">
                        {person.kind === "user" && (
                          <input
                            type="checkbox"
                            form="bulk-form"
                            name="userIds"
                            value={person.id}
                            checked={selected.has(person.id)}
                            onChange={() => toggle(person.id)}
                            aria-label={fmt(p.selectPerson, {
                              name: person.name || person.email || person.id,
                            })}
                            className={tick}
                          />
                        )}
                      </td>
                    )}
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
        </div>
      )}
    </div>
  );
}
