import { Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/admin.users.$id";
import { isOwner, requireRole } from "~/server/auth.server";
import { getUserAssignedModels, getUserById } from "~/server/repositories/users.server";
import { getLastActiveDay } from "~/server/repositories/usage.server";
import { listTeams, listTeamsForUser } from "~/server/repositories/teams.server";
import { teamPlaces } from "~/server/repositories/organisation.server";
import { getEnabledModels, getOwnerUserId } from "~/server/repositories/settings.server";
import { portfolioAccess } from "~/server/portfolioAccess.server";
import { effectiveFeatures, effectiveTools } from "~/server/availability.server";
import { featureKey, getExceptions, toolKey } from "~/server/repositories/exceptions.server";
import { FEATURES } from "~/lib/features";
import { ALL_TOOLS } from "~/lib/registry";
import { fullCatalog } from "~/server/modelCatalog.server";
import { mayManage } from "~/server/userAdmin.server";
import { personAction } from "~/server/personActions.server";
import { personCourses } from "~/server/adminCourses.server";
import { isTwoFactorEnabled } from "~/server/repositories/twoFactor.server";
import { ROLES, isRole } from "~/lib/registry/access";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { useFormToast } from "~/components/Toast";
import { Input, Select } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { TeacherModelForm } from "~/components/admin/TeacherModelForm";
import { TeamsForm } from "~/components/admin/TeamsForm";
import { PersonAccess } from "~/components/admin/PersonAccess";
import { PersonCourses } from "~/components/admin/PersonCourses";
import { LastActive, OwnerBadge, StatusBadge, roleLabel } from "~/components/admin/people";
import { PersonFeatures, type FeatureRow } from "~/components/features/PersonFeatures";

/**
 * One person's page (P28.1): everything about one account in one place: Account
 * (name, e-mail, role), Teams, Models, Parts and tools (the effective stand, its source
 * and the admin's exception, P28.3), Access (reset link, password, deactivation) and Delete. The user is the one in the URL; a `userId` in a form is ignored.
 * Authority is exactly as on the old list: `mayManage`, `ownerOnly`, never on yourself.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const target = await getUserById(params.id);
  if (!target) throw new Response("Not found", { status: 404 });
  const [viewerIsOwner, storedOwnerId, lastActiveDay, allTeams, ownTeams, twoFactor, places] =
    await Promise.all([
      isOwner(admin),
      getOwnerUserId(),
      getLastActiveDay(target.id),
      listTeams(),
      listTeamsForUser(target.id),
      isTwoFactorEnabled(target.id),
      teamPlaces(),
    ]);
  // Every team, with this person's membership and lead stand (P28.2), and where it sits.
  const stand = new Map(ownTeams.map((team) => [team.id, team.isLead]));
  const teams = allTeams.map((team) => ({
    id: team.id,
    name: team.name,
    member: stand.has(team.id),
    lead: stand.get(team.id) ?? false,
    place: places.get(team.id) ?? null,
  }));

  // Models, parts and tools are per teacher (P18, P28.3).
  let models: {
    base: { id: string; displayName: string }[];
    mode: "own" | "inherit";
    models: string[];
  } | null = null;
  let features: FeatureRow[] | null = null;
  if (target.role === "teacher") {
    const [catalog, instanceModels, own, access, featureStands, toolStands, exceptions] =
      await Promise.all([
        fullCatalog(),
        getEnabledModels(),
        getUserAssignedModels(target.id),
        portfolioAccess(target),
        effectiveFeatures(target),
        effectiveTools(target),
        getExceptions(target.id),
      ]);
    // An own set replaces the instance and may be wider, so the boxes run over the
    // whole catalogue. Following the instance shows the instance set (greyed out), so
    // that switching to "own" autosaves a sensible, non-empty starting selection.
    const base = catalog.map((m) => ({ id: m.id, displayName: m.displayName }));
    models = own
      ? { base, mode: "own", models: [...own] }
      : { base, mode: "inherit", models: instanceModels ?? base.map((m) => m.id) };
    const row = (
      key: string,
      kind: FeatureRow["kind"],
      name: FeatureRow["name"],
      d: (typeof featureStands)[keyof typeof featureStands],
      on = d.on,
    ): FeatureRow => ({
      key,
      kind,
      name,
      on,
      source: d.source,
      team: d.source === "team" ? d.team : null,
      exception: exceptions.get(key) ?? null,
      instanceOff: d.source === "instance",
    });
    features = [
      // The BDB/BKE row shows the transition too (a dossier keeps it on).
      ...FEATURES.map((f) =>
        row(
          featureKey(f.id),
          "feature",
          f.name,
          featureStands[f.id],
          f.id === "portfolio" ? access : undefined,
        ),
      ),
      ...ALL_TOOLS.flatMap((tool) => {
        const stand = toolStands[tool.slug];
        return stand ? [row(toolKey(tool.slug), "tool", tool.name, stand)] : [];
      }),
    ];
  }

  return {
    isOwner: viewerIsOwner,
    isSelf: target.id === admin.id,
    canManage: mayManage(viewerIsOwner, target),
    person: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      status: target.disabledAt ? ("disabled" as const) : ("active" as const),
      lastActiveDay,
      ownerBadge: target.id === storedOwnerId && target.role === "admin",
      twoFactor,
    },
    models,
    features,
    teams,
    // A teacher's courses (BESLUIT-2026-11-10-5): the admin hands them over, also when gone.
    courses:
      mayManage(viewerIsOwner, target) && target.id !== admin.id
        ? await personCourses(target.id)
        : null,
  };
}

/** Every change to this person (`personActions.server`); the user is the one in the URL. */
export async function action({ request, params }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  // Authority is decided on the server, for every intent; the page only hides.
  return personAction(admin, await isOwner(admin), request, params.id);
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function AdminUser({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.people;
  const i = t.admin.invites;
  const actionData = useActionData<typeof action>();
  const {
    person,
    isOwner: viewerIsOwner,
    isSelf,
    canManage,
    models,
    features,
    teams,
    courses,
  } = loaderData;
  const manage = canManage && !isSelf;
  const displayName = person.name || person.email || person.id;

  const errors: Record<string, string> = {
    selfDelete: i.selfDeleteError,
    selfReset: i.selfResetError,
    selfPassword: i.selfPasswordError,
    selfDeactivate: i.selfDeactivateError,
    selfDemote: i.selfDemoteError,
    selfEmail: i.selfEmailError,
    selfTwoFactor: t.twoFactor.selfReset,
    ownerOnly: i.ownerOnlyError,
    invalidEmail: i.invalidEmailError,
    emailTaken: i.emailTakenError,
    passwordCommon: t.auth.passwordCommon,
    passwordTooShort: t.auth.passwordTooShort,
    passwordMismatch: t.auth.passwordMismatch,
    atLeastOne: t.admin.models.atLeastOne,
    courseRefused: t.courseMembers.admin.refused,
  };
  const autoSaveError = (code: string | true) =>
    typeof code === "string" ? errors[code] : undefined;

  // The buttons (reset link, password, (de)activate, delete) report through one toast;
  // the autosaving controls report through their own fetcher toast.
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && typeof d.error === "string"
          ? { variant: "error", message: errors[d.error] ?? t.error.generic }
          : {
              variant: "success",
              message:
                "passwordSet" in d
                  ? i.passwordSet
                  : "twoFactorReset" in d
                    ? t.twoFactor.adminResetDone
                    : "coursesTransferred" in d
                      ? fmt(t.courseMembers.admin.transferred, { n: d.coursesTransferred ?? 0 })
                      : t.admin.console.saved,
            },
  });

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-violet-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {p.back}
        </Link>
        <h1 className="mt-3 font-display text-xl font-medium tracking-tight text-slate-900">
          {displayName}
          {person.ownerBadge && <OwnerBadge />}
        </h1>
        {isSelf && (
          <p className="mt-2 text-sm text-slate-600">
            {p.selfNote}{" "}
            <Link to="/account" className="font-medium text-violet-700 underline">
              {p.selfNoteLink}
            </Link>
            .
          </p>
        )}
        {!canManage && !isSelf && <p className="mt-2 text-sm text-slate-600">{p.notManageable}</p>}
      </div>

      {/* ── Account ────────────────────────────────────────────────────────── */}
      <section>
        <h2 className={h2}>{p.account}</h2>
        <dl className={`mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr] ${card}`}>
          <dt className="font-medium text-slate-600">
            {manage ? <label htmlFor="person-email">{p.emailLabel}</label> : p.emailLabel}
          </dt>
          <dd className="text-slate-800">
            {manage ? (
              <AutoSaveForm intent="setEmail" errorMessage={autoSaveError}>
                <Input
                  id="person-email"
                  name="email"
                  type="email"
                  defaultValue={person.email ?? ""}
                  placeholder={i.emailPlaceholder}
                  className="h-9 max-w-xs text-sm"
                />
              </AutoSaveForm>
            ) : (
              (person.email ?? "—")
            )}
          </dd>
          <dt className="font-medium text-slate-600">
            {viewerIsOwner && !isSelf && isRole(person.role) ? (
              <label htmlFor="person-role">{p.roleLabel}</label>
            ) : (
              p.roleLabel
            )}
          </dt>
          <dd className="text-slate-800">
            {viewerIsOwner && !isSelf && isRole(person.role) ? (
              <AutoSaveForm intent="role" errorMessage={autoSaveError}>
                <Select id="person-role" name="role" defaultValue={person.role} className="w-auto">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(t, r)}
                    </option>
                  ))}
                </Select>
              </AutoSaveForm>
            ) : (
              roleLabel(t, person.role)
            )}
          </dd>
          <dt className="font-medium text-slate-600">{p.status}</dt>
          <dd>
            <StatusBadge status={person.status} />
          </dd>
          <dt className="font-medium text-slate-600">{t.twoFactor.adminLabel}</dt>
          <dd className="text-slate-800">
            {person.twoFactor ? t.twoFactor.statusOn : t.twoFactor.statusOff}
          </dd>
          <dt className="font-medium text-slate-600">{p.lastActive}</dt>
          <dd className="text-slate-800">
            <LastActive day={person.lastActiveDay} />
          </dd>
        </dl>
      </section>

      {/* ── Teams (P28.2): member and lead per team ────────────────────────── */}
      <section>
        <h2 className={h2}>{t.teams.heading}</h2>
        <div className={`mt-3 ${card}`}>
          {teams.length === 0 ? (
            <p className="text-sm text-slate-600">
              {t.teams.noTeams}{" "}
              <Link to="/admin/teams" className="font-medium text-violet-700 underline">
                {t.teams.manageTeams}
              </Link>
            </p>
          ) : canManage ? (
            <TeamsForm teams={teams} errorMessage={autoSaveError} />
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
              {teams
                .filter((team) => team.member)
                .map((team) => (
                  <li key={team.id}>
                    {team.name}
                    {team.lead && ` (${t.teams.leadBadge})`}
                  </li>
                ))}
              {!teams.some((team) => team.member) && <li>{t.teams.noTeam}</li>}
            </ul>
          )}
        </div>
      </section>

      {/* ── Models (P18): follow the instance, or an own set ───────────────── */}
      {models && (
        <section>
          <h2 className={h2}>{p.models}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.admin.models.teacherIntro}</p>
          <div className="mt-3 max-w-xl">
            <TeacherModelForm
              teacher={{
                id: person.id,
                name: person.name,
                email: null,
                mode: models.mode,
                models: models.models,
              }}
              base={models.base}
              errorMessage={autoSaveError}
              inheritLabel={t.admin.models.teacherInherit}
              ownLabel={t.admin.models.teacherOwn}
            />
          </div>
        </section>
      )}

      {/* ── Parts and tools: effective stand, source, exception (P28.3) ─────── */}
      {features && <PersonFeatures rows={features} errorMessage={autoSaveError} />}

      {courses && <PersonCourses list={courses.list} colleagues={courses.colleagues} />}

      {manage && (
        <PersonAccess
          lostCourses={courses?.lost ?? 0}
          person={person}
          displayName={displayName}
          viewerIsOwner={viewerIsOwner}
          resetLink={
            actionData && "resetLink" in actionData && actionData.resetLink
              ? actionData.resetLink
              : undefined
          }
        />
      )}
    </div>
  );
}
