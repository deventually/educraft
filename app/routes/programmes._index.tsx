import { useId } from "react";
import { Link, redirect, useActionData, useSearchParams } from "react-router";
import { Layers, Trash2 } from "lucide-react";
import type { Route } from "./+types/programmes._index";
import { kindOptions, programmeFromForm, requireProgrammeUser } from "~/server/programmes.server";
import {
  createProgramme,
  deleteProgramme,
  listProgrammes,
  manageableTeams,
} from "~/server/repositories/programmes.server";
import { programmeKindLabel, ProgrammeInputSchema } from "~/lib/programmes/schema";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { NewProgramme } from "~/components/programmes/NewProgramme";
import { getDivisionKind, listDivisions } from "~/server/repositories/organisation.server";
import { divisionWord } from "~/lib/organisation/kinds";
import { loc } from "~/lib/i18n/localized";
import { useT } from "~/lib/i18n/useT";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";

export function meta() {
  return [{ title: "Opleidingen — LimeOnIt" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireProgrammeUser(request);
  const locale = getLocale(request);
  const programmes = (await listProgrammes(user)).map((p) => ({
    id: p.id,
    name: p.name,
    kind: programmeKindLabel(p, locale),
    teamName: p.teamName,
    courses: p.courseCount,
    // Only an admin deletes a programme (BESLUIT-2026-11-16-3); a lead manages it.
    canDelete: user.role === "admin",
  }));
  const isAdmin = user.role === "admin";
  return {
    programmes,
    kinds: await kindOptions(user, locale),
    // The teams this person may create a programme for: where they lead (an admin: all).
    teams: await manageableTeams(user),
    // An admin may start one without a team, under a faculty (BESLUIT-2026-11-16-4).
    isAdmin,
    divisions: isAdmin ? (await listDivisions()).map(({ id, name }) => ({ id, name })) : [],
    divisionWord: loc(divisionWord(await getDivisionKind()), locale),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireProgrammeUser(request);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).programmes;
  const intent = fd.get("intent");
  if (intent === "delete") {
    if (user.role !== "admin") return { ok: false as const, error: m.errorDeleteAdminOnly };
    return (await deleteProgramme(user, String(fd.get("id") ?? "")))
      ? { ok: true as const }
      : { ok: false as const, error: m.errorNotFound };
  }
  if (intent === "create") {
    const input = programmeFromForm(fd);
    const parsed = ProgrammeInputSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false as const,
        error: parsed.error.issues.some((i) => i.path[0] === "name") ? m.errorName : m.errorInvalid,
      };
    const programme = await createProgramme(
      user,
      String(fd.get("teamId") ?? "") || null,
      parsed.data,
      String(fd.get("divisionId") ?? "") || null,
    );
    if (!programme) return { ok: false as const, error: m.errorNotAllowed };
    return redirect(`/programmes/${programme.id}`);
  }
  return { ok: false as const, error: m.errorInvalid };
}

/** The list of programmes (opleidingen) and the form for a new one. */
export default function ProgrammeList({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const p = t.programmes;
  const id = useId();
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) => {
      if (!d) return null;
      if (!d.ok) return { variant: "error", message: d.error };
      return { variant: "success", message: p.toastDeleted };
    },
  });
  const { programmes, kinds, teams } = loaderData;
  const isAdmin = "isAdmin" in loaderData && !!loaderData.isAdmin;
  const divisions = "divisions" in loaderData ? loaderData.divisions : [];
  const divisionWord = "divisionWord" in loaderData ? loaderData.divisionWord : undefined;
  const canCreate = isAdmin || teams.length > 0;
  // "New programme for this team" on an admin's team page links here with ?team=<id>.
  const [search] = useSearchParams();
  const askedTeam = search.get("team");
  const defaultTeam = teams.some((team) => team.id === askedTeam) ? askedTeam : undefined;

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {p.heading}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">{p.intro}</p>
      <p className="mt-2 text-sm">
        <Link
          to="/help/programmes"
          className="font-medium text-violet-700 underline underline-offset-2"
        >
          {p.help}
        </Link>
      </p>

      {canCreate ? (
        <div className="mt-6">
          <NewProgramme
            kinds={kinds}
            teams={teams}
            isAdmin={isAdmin}
            divisions={divisions}
            divisionWord={divisionWord}
            defaultTeam={defaultTeam ?? undefined}
            startOpen={!!defaultTeam}
            triggerId={`${id}-new`}
          />
        </div>
      ) : (
        <p className="mt-6 max-w-[65ch] rounded-2xl border border-slate-200 bg-white p-4 text-slate-600">
          {p.noTeams}
        </p>
      )}

      {programmes.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden />}
          title={p.emptyTitle}
          body={p.emptyBody}
          action={
            canCreate
              ? {
                  label: p.createTitle,
                  onClick: () => document.getElementById(`${id}-new`)?.click(),
                }
              : { label: p.help, to: "/help/programmes" }
          }
        />
      ) : (
        <section className="mt-8" aria-labelledby={`${id}-list`}>
          <h2 id={`${id}-list`} className="text-lg font-medium text-slate-900">
            {p.listTitle}
          </h2>
          <ul className="mt-3 space-y-3">
            {programmes.map((programme) => (
              <li
                key={programme.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/programmes/${programme.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {programme.name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {fmt(p.summary, {
                      kind: programme.kind,
                      team: programme.teamName,
                      courses: programme.courses,
                    })}
                  </p>
                </div>
                {programme.canDelete && (
                  <ConfirmDialog
                    triggerLabel={`${p.delete}: ${programme.name}`}
                    triggerIcon={<Trash2 className="size-4" aria-hidden />}
                    triggerIconOnly
                    title={p.deleteTitle}
                    description={p.deleteBody}
                    confirmLabel={p.delete}
                    cancelLabel={t.confirm.cancel}
                    fields={{ intent: "delete", id: programme.id }}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
