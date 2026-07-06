import { Form, useActionData } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/admin.context";
import { requireRole } from "~/server/auth.server";
import {
  getEnabledCountries,
  getEnabledSectors,
  setEnabledCountries,
  setEnabledSectors,
} from "~/server/repositories/settings.server";
import {
  getUserAssignedCountries,
  getUserAssignedSectors,
  getUserById,
  listUsers,
  setUserAssignedCountries,
  setUserAssignedSectors,
} from "~/server/repositories/users.server";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  type CountryCode,
  isCountryCode,
} from "~/lib/context/countries";
import { SECTORS, SECTORS_INFO, type Sector, isSector } from "~/lib/context/sectors";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { Button } from "~/components/ui";

/**
 * Country/sector availability write UI (Phase 9), the exact analog of
 * `admin.models.tsx`. Two axes:
 *   - Instance: an admin toggles which countries + sectors the instance offers
 *     (lockout guard: an axis may not be emptied).
 *   - Per teacher: an admin narrows an individual teacher to a subset (empty =
 *     clear the restriction — a legitimate "unrestricted", not a lockout).
 *
 * On top of P8's already-shipped read/compose seam, writing these keys narrows
 * the context editor with zero engine work. `null` (unset) = all, so a fresh
 * instance is unchanged.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [enabledCountries, enabledSectors, allUsers] = await Promise.all([
    getEnabledCountries(),
    getEnabledSectors(),
    listUsers(),
  ]);
  const countries = COUNTRIES.map((id) => ({
    id,
    checked: enabledCountries === null || enabledCountries.includes(id),
  }));
  const sectors = SECTORS.map((id) => ({
    id,
    checked: enabledSectors === null || enabledSectors.includes(id),
  }));
  const teachers = await Promise.all(
    allUsers
      .filter((u) => u.role === "teacher")
      .map(async (u) => {
        const [ac, as] = await Promise.all([
          getUserAssignedCountries(u.id),
          getUserAssignedSectors(u.id),
        ]);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          // null (unrestricted) preserved; a Set becomes a plain array to serialize.
          countries: ac ? [...ac] : null,
          sectors: as ? [...as] : null,
        };
      }),
  );
  return { countries, sectors, teachers };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  // Never trust the body: keep only shipped catalogue codes on both axes.
  const countries = fd.getAll("countries").map(String).filter(isCountryCode);
  const sectors = fd.getAll("sectors").map(String).filter(isSector);

  if (intent === "instance") {
    // Lockout guard (mirrors admin.models): an admin may not empty an axis.
    if (countries.length === 0 || sectors.length === 0) {
      return { error: "instance-empty" as const };
    }
    await setEnabledCountries(countries);
    await setEnabledSectors(sectors);
    return { saved: true as const };
  }

  if (intent === "teacher") {
    // The target must resolve to a real teacher account (security boundary).
    const userId = String(fd.get("userId") ?? "");
    const target = await getUserById(userId);
    if (!target || target.role !== "teacher") {
      throw new Response("Not found", { status: 404 });
    }
    // Empty = clear the restriction (unrestricted), not a lockout.
    await setUserAssignedCountries(userId, countries.length ? countries : null);
    await setUserAssignedSectors(userId, sectors.length ? sectors : null);
    return { saved: true as const };
  }

  throw new Response("Bad request", { status: 400 });
}

/** One checkbox fieldset over a catalogue axis (countries or sectors). */
function CheckAxis({
  legend,
  name,
  idPrefix,
  options,
}: {
  legend: string;
  name: string;
  idPrefix: string;
  options: { id: string; label: string; checked: boolean }[];
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <legend className="px-1 text-sm font-semibold text-slate-800">{legend}</legend>
      <ul className="mt-2 space-y-2.5">
        {options.map((o) => (
          <li key={o.id} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id={`${idPrefix}-${o.id}`}
              name={name}
              value={o.id}
              defaultChecked={o.checked}
              className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
            />
            <label htmlFor={`${idPrefix}-${o.id}`} className="text-sm font-medium text-slate-800">
              {o.label}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

export default function AdminContext({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { countries, sectors, teachers } = loaderData;
  const c = t.admin.context;

  const countryLabel = (id: CountryCode) => loc(COUNTRY_LABELS[id], locale);
  const sectorLabel = (id: Sector) => loc(SECTORS_INFO[id].label, locale);
  // A teacher assignment is `null` (unrestricted → all checked) or a subset.
  const isAssigned = (assigned: string[] | null, id: string) =>
    assigned === null || assigned.includes(id);

  return (
    <section>
      <h2
        id="admin-context-heading"
        className="font-display text-lg font-medium tracking-tight text-slate-900"
      >
        {c.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{c.intro}</p>

      {actionData?.error === "instance-empty" && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {c.atLeastOne}
        </p>
      )}
      <p className="mt-3 h-5 text-sm text-emerald-700" aria-live="polite">
        {actionData?.saved ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4" aria-hidden />
            {t.admin.console.saved}
          </span>
        ) : (
          ""
        )}
      </p>

      {/* Instance-level toggle — labelled by the page heading. */}
      <Form method="post" aria-labelledby="admin-context-heading" className="mt-2 max-w-xl">
        <input type="hidden" name="intent" value="instance" />
        <div className="space-y-4">
          <CheckAxis
            legend={c.countriesLegend}
            name="countries"
            idPrefix="instance-country"
            options={countries.map((x) => ({
              id: x.id,
              label: countryLabel(x.id),
              checked: x.checked,
            }))}
          />
          <CheckAxis
            legend={c.sectorsLegend}
            name="sectors"
            idPrefix="instance-sector"
            options={sectors.map((x) => ({
              id: x.id,
              label: sectorLabel(x.id),
              checked: x.checked,
            }))}
          />
        </div>
        <Button type="submit" className="mt-4">
          {c.save}
        </Button>
      </Form>

      {/* Per-teacher assignment. */}
      <div className="mt-10 max-w-xl">
        <h3 className="font-display text-base font-medium tracking-tight text-slate-900">
          {c.teacherLegend}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{c.teacherPick}</p>
        <p className="mt-1 text-xs text-slate-500">{c.teacherHint}</p>

        {teachers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{c.teacherNone}</p>
        ) : (
          <ul className="mt-4 list-none space-y-6 p-0">
            {teachers.map((teacher) => (
              <li
                key={teacher.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <Form method="post" aria-labelledby={`teacher-${teacher.id}-heading`}>
                  <input type="hidden" name="intent" value="teacher" />
                  <input type="hidden" name="userId" value={teacher.id} />
                  <div>
                    <h4
                      id={`teacher-${teacher.id}-heading`}
                      className="text-sm font-semibold text-slate-900"
                    >
                      {teacher.name}
                    </h4>
                    {teacher.email && <p className="text-xs text-slate-500">{teacher.email}</p>}
                  </div>
                  <div className="mt-3 space-y-4">
                    <CheckAxis
                      legend={c.countriesLegend}
                      name="countries"
                      idPrefix={`teacher-${teacher.id}-country`}
                      options={countries.map((x) => ({
                        id: x.id,
                        label: countryLabel(x.id),
                        checked: isAssigned(teacher.countries, x.id),
                      }))}
                    />
                    <CheckAxis
                      legend={c.sectorsLegend}
                      name="sectors"
                      idPrefix={`teacher-${teacher.id}-sector`}
                      options={sectors.map((x) => ({
                        id: x.id,
                        label: sectorLabel(x.id),
                        checked: isAssigned(teacher.sectors, x.id),
                      }))}
                    />
                  </div>
                  <Button type="submit" className="mt-4">
                    {c.save}
                  </Button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
