import { useEffect, useState } from "react";
import { useActionData } from "react-router";
import { z } from "zod";
import { UserPlus } from "lucide-react";
import type { Route } from "./+types/admin.users";
import { isOwner, requireRole } from "~/server/auth.server";
import { getUserById, listPeople } from "~/server/repositories/users.server";
import { getOwnerUserId } from "~/server/repositories/settings.server";
import { listTeams } from "~/server/repositories/teams.server";
import { peopleListAction } from "~/server/peopleList.server";
import { ROLES } from "~/lib/registry/access";
import { BULK_ACTIONS, OWNER_ONLY_BULK } from "~/lib/people/bulk";
import type { PasteOutcome } from "~/lib/people/pasteList";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Button } from "~/components/ui";
import { AddPersonForm } from "~/components/admin/AddPersonForm";
import { BulkBar } from "~/components/admin/BulkBar";
import { PeopleFilters } from "~/components/admin/PeopleFilters";
import { PeopleTable } from "~/components/admin/PeopleTable";

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

/** Invites, a pasted list, a direct account and "With selected" (`peopleList.server`). */
export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  // Authority is decided on the server, for every intent; the page only hides.
  return peopleListAction(admin, await isOwner(admin), request);
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
    passwordCommon: t.auth.passwordCommon,
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
            <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
              {p.heading}
            </h2>
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

      <PeopleFilters filter={filter} teams={teams} />

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
          <PeopleTable
            people={people}
            selfId={selfId}
            ownerId={ownerId}
            selection={
              canBulk
                ? {
                    selected,
                    allTicked,
                    toggle,
                    toggleAll: () => setSelected(allTicked ? new Set() : new Set(accountIds)),
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
