import { useId } from "react";
import { Form, Link, redirect, useActionData } from "react-router";
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
import { Button, Card, Label, Select } from "~/components/ui";
import { EmptyState } from "~/components/EmptyState";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { useFormToast } from "~/components/Toast";
import { ProgrammeFields } from "~/components/programmes/ProgrammeFields";
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
    canManage: p.canManage,
  }));
  return {
    programmes,
    kinds: await kindOptions(user, locale),
    // The teams this person may create a programme for: where they lead (an admin: all).
    teams: await manageableTeams(user),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireProgrammeUser(request);
  const fd = await request.formData();
  const m = getMessages(getLocale(request)).programmes;
  const intent = fd.get("intent");
  if (intent === "delete") {
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
    const programme = await createProgramme(user, String(fd.get("teamId") ?? ""), parsed.data);
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
  const defaultKind = kinds.some((k) => k.value === "hbo:bachelor") ? "hbo:bachelor" : "";

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

      {teams.length === 0 ? (
        <p className="mt-6 max-w-[65ch] rounded-2xl border border-slate-200 bg-white p-4 text-slate-600">
          {p.noTeams}
        </p>
      ) : (
        <Card className="mt-6 p-5">
          <h2 className="text-lg font-medium text-slate-900">{p.createTitle}</h2>
          <Form method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="intent" value="create" />
            <div>
              <Label htmlFor={`${id}-team`}>{p.team}</Label>
              <Select id={`${id}-team`} name="teamId" className="mt-1">
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <ProgrammeFields
              id={id}
              kinds={kinds}
              defaults={{ name: "", kind: defaultKind, form: "" }}
            />
            <div className="sm:col-span-2">
              <Button type="submit">{p.create}</Button>
            </div>
          </Form>
        </Card>
      )}

      {programmes.length === 0 ? (
        <EmptyState
          icon={<Layers aria-hidden />}
          title={p.emptyTitle}
          body={p.emptyBody}
          action={
            teams.length > 0
              ? {
                  label: p.createTitle,
                  onClick: () => document.getElementById(`${id}-name`)?.focus(),
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
                {programme.canManage && (
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
