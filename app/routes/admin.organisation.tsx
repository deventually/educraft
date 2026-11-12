import { Form, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin.organisation";
import { requireRole } from "~/server/auth.server";
import {
  createDivision,
  deleteDivision,
  getDivisionKind,
  listDivisions,
  renameDivision,
  setDivisionKind,
  setProgrammeDivision,
} from "~/server/repositories/organisation.server";
import { listProgrammes } from "~/server/repositories/programmes.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { programmeKindLabel } from "~/lib/programmes/schema";
import { DIVISION_KINDS, divisionWord } from "~/lib/organisation/kinds";
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
    programmes: programmes.map((p) => ({
      id: p.id,
      name: p.name,
      kindLabel: programmeKindLabel(p, locale),
      teamName: p.teamName,
      divisionId: p.divisionId,
    })),
  };
}

const Id = z.string().trim().min(1).max(100);

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
    case "move": {
      const programmeId = Id.safeParse(field("programmeId"));
      const divisionId = field("divisionId").trim() || null;
      if (!programmeId.success) return { error: "invalid" as const };
      return (await setProgrammeDivision(admin, programmeId.data, divisionId))
        ? { ok: "move" as const }
        : { error: "invalid" as const };
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
  const word = loc(divisionWord(kind), locale);
  const options = divisions.map((d) => ({ id: d.id, name: d.name }));
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
            <HelpText id="division-kind-hint">{o.kindHint}</HelpText>
          </div>
          <Button type="submit" variant="secondary">
            {o.kindSave}
          </Button>
        </Form>
      </section>

      <Form
        method="post"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="intent" value="create" />
        <div className="min-w-48 flex-1 sm:max-w-sm">
          <Label htmlFor="division-new">{o.addName}</Label>
          <Input id="division-new" name="name" required maxLength={200} className="mt-1" />
        </div>
        <Button type="submit">{fmt(o.add, { kind: word })}</Button>
      </Form>

      {programmes.length === 0 && <p className="text-sm text-slate-500">{o.noProgrammes}</p>}

      {divisions.map((d) => (
        <DivisionSection
          key={d.id}
          division={d}
          programmes={programmes.filter((p) => p.divisionId === d.id)}
          options={options}
        />
      ))}

      {unplaced.length > 0 && (
        <DivisionSection
          heading={fmt(o.none, { kind: word.toLowerCase() })}
          programmes={unplaced}
          options={options}
        />
      )}
    </div>
  );
}
