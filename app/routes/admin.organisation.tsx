import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.organisation";
import { requireRole } from "~/server/auth.server";
import {
  createDivision,
  deleteDivision,
  getDivisionKind,
  listDivisions,
  renameDivision,
  setDivisionKind,
} from "~/server/repositories/organisation.server";
import { listProgrammes } from "~/server/repositories/programmes.server";
import { manageableTeams } from "~/server/repositories/programmeTeams.server";
import { kindOptions } from "~/server/programmes.server";
import { NewProgramme } from "~/components/programmes/NewProgramme";
import { getLocale } from "~/lib/i18n/locale.server";
import { programmeKindLabel } from "~/lib/programmes/schema";
import { DIVISION_KINDS, divisionWord, newDivisionLabel } from "~/lib/organisation/kinds";
import { NewDialog } from "~/components/connections/NewDialog";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { useFormToast } from "~/components/Toast";
import { Button, HelpText, Input, Label, Select } from "~/components/ui";
import { DivisionSection } from "~/components/organisation/DivisionSection";

/**
 * Beheer → Organisatie (BESLUIT-2026-11-12-2): what the institution calls the layer between
 * itself and its programmes, its divisions, and which programme sits under which. The
 * programmes themselves are made by their team on /programmes; here an admin only places them.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const admin = await requireRole(request, "admin");
  const locale = getLocale(request);
  const programmes = await listProgrammes(admin, 500);
  return {
    kind: await getDivisionKind(),
    divisions: await listDivisions(),
    // For "Nieuwe opleiding" in each faculty (BESLUIT-2026-11-16-4).
    kinds: await kindOptions(admin, locale),
    teams: await manageableTeams(admin),
    programmes: programmes.map((p) => ({
      id: p.id,
      name: p.name,
      kindLabel: programmeKindLabel(p, locale),
      teamName: p.teamName,
      divisionId: p.divisionId,
    })),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const admin = await requireRole(request, "admin");
  const fd = await request.formData();
  const field = (k: string) => String(fd.get(k) ?? "");
  switch (fd.get("intent")) {
    case "kind":
      return (await setDivisionKind(admin, field("kind")))
        ? { ok: "kind" as const }
        : { error: "invalid" as const };
    case "create":
      return (await createDivision(admin, field("name")))
        ? { ok: "create" as const }
        : { error: "name" as const };
    case "rename":
      return (await renameDivision(admin, field("id"), field("name")))
        ? { ok: "rename" as const }
        : { error: "name" as const };
    case "delete": {
      const result = await deleteDivision(admin, field("id"));
      if (result === "deleted") return { ok: "delete" as const };
      return { error: result === "notEmpty" ? ("notEmpty" as const) : ("invalid" as const) };
    }
    default:
      return { error: "invalid" as const };
  }
}

const h2 = "font-display text-lg font-medium tracking-tight text-slate-900";

export default function AdminOrganisation({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const o = t.organisation;
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { kind, divisions, programmes } = loaderData;
  const kinds = "kinds" in loaderData ? loaderData.kinds : [];
  const teams = "teams" in loaderData ? loaderData.teams : [];
  const word = loc(divisionWord(kind), locale);
  const errors = { invalid: o.errorInvalid, name: o.errorName, notEmpty: o.errorNotEmpty };

  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d && d.error
          ? { variant: "error", message: errors[d.error] }
          : { variant: "success", message: t.admin.console.saved },
  });

  const unplaced = programmes.filter(
    (p) => !p.divisionId || !divisions.some((d) => d.id === p.divisionId),
  );

  return (
    <div className="space-y-6">
      <section>
        <h2 className={h2}>{o.heading}</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{o.intro}</p>
        <Form method="post" className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="intent" value="kind" />
          <div className="min-w-48 flex-1 sm:max-w-sm">
            <Label htmlFor="division-kind">{o.kindLabel}</Label>
            <Select
              id="division-kind"
              name="kind"
              defaultValue={kind ?? ""}
              aria-describedby="division-kind-hint"
              className="mt-1"
            >
              {!kind && (
                <option value="" disabled>
                  {o.kindNone}
                </option>
              )}
              {DIVISION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {loc(k.one, locale)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            {o.kindSave}
          </Button>
        </Form>
        {/* Under the row, not in the field: so the button lines up with the select. */}
        <HelpText id="division-kind-hint">{o.kindHint}</HelpText>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">{o.moveHint}</p>
        <NewDialog
          triggerLabel={loc(newDivisionLabel(kind), locale)}
          title={loc(newDivisionLabel(kind), locale)}
          intent="create"
          submitLabel={o.create}
        >
          <div>
            <Label htmlFor="division-new">{o.addName}</Label>
            <Input
              id="division-new"
              name="name"
              required
              maxLength={200}
              className="mt-1"
              data-autofocus
            />
          </div>
        </NewDialog>
      </div>

      {programmes.length === 0 && <p className="text-sm text-slate-500">{o.noProgrammes}</p>}

      {divisions.map((d) => (
        <DivisionSection
          key={d.id}
          division={d}
          programmes={programmes.filter((p) => p.divisionId === d.id)}
          newProgramme={
            <NewProgramme
              kinds={kinds}
              teams={teams}
              isAdmin
              division={d}
              title={fmt(t.programmes.createIn, { name: d.name })}
            />
          }
        />
      ))}

      {unplaced.length > 0 && (
        <DivisionSection
          heading={fmt(o.none, { kind: word.toLowerCase() })}
          programmes={unplaced}
        />
      )}
    </div>
  );
}
