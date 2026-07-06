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
import { COUNTRIES, COUNTRY_LABELS, isCountryCode } from "~/lib/context/countries";
import { SECTORS, SECTORS_INFO, isSector } from "~/lib/context/sectors";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { Button } from "~/components/ui";

/**
 * Country/sector availability write UI (Phase 9), the exact analog of
 * `admin.models.tsx`: an admin toggles which countries + sectors the instance
 * offers. On top of P8's already-shipped read/compose seam, writing these keys
 * narrows the context editor with zero engine work. `null` (unset) = all → a
 * fresh instance is unchanged.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [enabledCountries, enabledSectors] = await Promise.all([
    getEnabledCountries(),
    getEnabledSectors(),
  ]);
  const countries = COUNTRIES.map((id) => ({
    id,
    checked: enabledCountries === null || enabledCountries.includes(id),
  }));
  const sectors = SECTORS.map((id) => ({
    id,
    checked: enabledSectors === null || enabledSectors.includes(id),
  }));
  return { countries, sectors };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  if (intent === "instance") {
    // Never trust the body: keep only shipped catalogue codes.
    const countries = fd.getAll("countries").map(String).filter(isCountryCode);
    const sectors = fd.getAll("sectors").map(String).filter(isSector);
    // Lockout guard (mirrors admin.models): an admin may not empty an axis.
    if (countries.length === 0 || sectors.length === 0) {
      return { error: "instance-empty" as const };
    }
    await setEnabledCountries(countries);
    await setEnabledSectors(sectors);
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
  const { countries, sectors } = loaderData;
  const c = t.admin.context;

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
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

      <Form method="post" className="mt-2 max-w-xl">
        <input type="hidden" name="intent" value="instance" />
        <div className="space-y-4">
          <CheckAxis
            legend={c.countriesLegend}
            name="countries"
            idPrefix="instance-country"
            options={countries.map((x) => ({
              id: x.id,
              label: loc(COUNTRY_LABELS[x.id], locale),
              checked: x.checked,
            }))}
          />
          <CheckAxis
            legend={c.sectorsLegend}
            name="sectors"
            idPrefix="instance-sector"
            options={sectors.map((x) => ({
              id: x.id,
              label: loc(SECTORS_INFO[x.id].label, locale),
              checked: x.checked,
            }))}
          />
        </div>
        <Button type="submit" className="mt-4">
          {c.save}
        </Button>
      </Form>
    </section>
  );
}
