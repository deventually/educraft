import { useState } from "react";
import { Form, useActionData } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/admin.context";
import { requireRole } from "~/server/auth.server";
import {
  getEnabledCountries,
  getEnabledSectors,
  getEnabledDomains,
  setEnabledCountries,
  setEnabledSectors,
  setEnabledDomains,
} from "~/server/repositories/settings.server";
import {
  getUserAssignedCountries,
  getUserAssignedSectors,
  getUserAssignedDomains,
  getUserContextCustomAccess,
  getUserById,
  listUsers,
  setUserAssignedCountries,
  setUserAssignedSectors,
  setUserAssignedDomains,
  setUserContextCustomAccess,
} from "~/server/repositories/users.server";
import {
  COUNTRIES,
  COUNTRY_LABELS,
  type CountryCode,
  isCountryCode,
} from "~/lib/context/countries";
import {
  SECTORS,
  SECTORS_INFO,
  TRACKS_BY_SECTOR,
  type Sector,
  isSector,
} from "~/lib/context/sectors";
import { domainGroupsForSector, allDomainValues, type DomainGroup } from "~/lib/context/domains";
import { loc } from "~/lib/i18n/localized";
import type { Locale } from "~/lib/i18n";
import { useLocale, useT } from "~/lib/i18n/useT";
import { Button } from "~/components/ui";

/**
 * Country/sector/domain availability write UI. Two axes, composed by the OVERRIDE
 * model (Phase 12):
 *   - Instance: an admin toggles which countries + sectors + domains the instance
 *     offers (lockout guard: country/sector may not be emptied; domains may — that
 *     means "all"). These are the defaults every teacher inherits.
 *   - Per teacher: an admin may give a teacher *custom access*. Activated, the
 *     teacher's own selection replaces the instance entirely (they can be granted
 *     more or fewer countries/sectors/domains; an empty axis = all). Left off, the
 *     teacher inherits the instance. Deactivating is non-destructive — it only
 *     flips the flag; the saved selections are preserved for re-activation.
 *
 * `null` (unset) = all, so a fresh instance is unchanged and needs no migration
 * (every key lives in `instance_settings`).
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [enabledCountries, enabledSectors, enabledDomains, allUsers] = await Promise.all([
    getEnabledCountries(),
    getEnabledSectors(),
    getEnabledDomains(),
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
  // The shared domain catalogue: only the sectors that actually carry a profiel
  // catalogue (vo, hbo) — mbo/wo use custom fields. Used for BOTH the instance
  // section and every teacher (custom access ignores the instance, so a teacher's
  // checkboxes are the full catalogue, not their reachable sectors).
  const domainCatalogueSectors = SECTORS.map((s) => ({
    sector: s as string,
    groups: domainGroupsForSector("NL", s),
  })).filter((ds) => ds.groups.length > 0);
  const teachers = await Promise.all(
    allUsers
      .filter((u) => u.role === "teacher")
      .map(async (u) => {
        const [ac, as, ad, customAccess] = await Promise.all([
          getUserAssignedCountries(u.id),
          getUserAssignedSectors(u.id),
          getUserAssignedDomains(u.id),
          getUserContextCustomAccess(u.id),
        ]);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          customAccess,
          // null (unrestricted) preserved; a Set becomes a plain array to serialize.
          countries: ac ? [...ac] : null,
          sectors: as ? [...as] : null,
          domains: ad ? [...ad] : null,
        };
      }),
  );
  return { countries, sectors, enabledDomains, domainCatalogueSectors, teachers };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  // Never trust the body: keep only shipped catalogue codes on every axis.
  const countries = fd.getAll("countries").map(String).filter(isCountryCode);
  const sectors = fd.getAll("sectors").map(String).filter(isSector);
  const knownDomains = new Set(allDomainValues("NL"));
  const domains = fd
    .getAll("domains")
    .map(String)
    .filter((d) => knownDomains.has(d));

  if (intent === "instance") {
    // Lockout guard (mirrors admin.models): an admin may not empty country/sector.
    // Domains may be empty — that just means "all domains".
    if (countries.length === 0 || sectors.length === 0) {
      return { error: "instance-empty" as const };
    }
    await setEnabledCountries(countries);
    await setEnabledSectors(sectors);
    await setEnabledDomains(domains.length ? domains : null);
    return { saved: true as const };
  }

  if (intent === "teacher") {
    // The target must resolve to a real teacher account (security boundary).
    const userId = String(fd.get("userId") ?? "");
    const target = await getUserById(userId);
    if (!target || target.role !== "teacher") {
      throw new Response("Not found", { status: 404 });
    }
    const customAccess = fd.get("customAccess") === "1";
    if (!customAccess) {
      // Deactivate: flip the flag off ONLY — the saved assignments are preserved
      // (non-destructive), so re-activating restores exactly what the teacher had.
      await setUserContextCustomAccess(userId, false);
      return { saved: true as const };
    }
    // Activated: the teacher's own selection is authoritative. Persist all three
    // axes (empty axis → null = unrestricted, i.e. the whole catalogue).
    await setUserContextCustomAccess(userId, true);
    await setUserAssignedCountries(userId, countries.length ? countries : null);
    await setUserAssignedSectors(userId, sectors.length ? sectors : null);
    await setUserAssignedDomains(userId, domains.length ? domains : null);
    return { saved: true as const };
  }

  throw new Response("Bad request", { status: 400 });
}

// ── Locale-aware label helpers (shared by the instance form + teacher forms) ──
const countryLabelFor = (id: CountryCode, locale: Locale) => loc(COUNTRY_LABELS[id], locale);
const sectorLabelFor = (id: Sector, locale: Locale) => loc(SECTORS_INFO[id].label, locale);
const sectorLabelStrFor = (s: string, locale: Locale) =>
  isSector(s) ? sectorLabelFor(s, locale) : s;
/** The track heading for a merged group (e.g. "havo · vwo"), from verified labels. */
const trackHeadingFor = (s: string, tracks: string[], locale: Locale) =>
  isSector(s)
    ? tracks
        .map((tv) => {
          const opt = TRACKS_BY_SECTOR[s].find((tr) => tr.value === tv);
          return opt ? loc(opt.label, locale) : tv;
        })
        .join(" · ")
    : tracks.join(" · ");
/** A teacher/instance assignment is `null` (unrestricted → all checked) or a subset. */
const isAssigned = (assigned: string[] | null, id: string) =>
  assigned === null || assigned.includes(id);

/** One checkbox fieldset over a catalogue axis (countries or sectors). */
function CheckAxis({
  legend,
  name,
  idPrefix,
  options,
  disabled,
}: {
  legend: string;
  name: string;
  idPrefix: string;
  options: { id: string; label: string; checked: boolean }[];
  disabled?: boolean;
}) {
  return (
    <fieldset
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${disabled ? "opacity-60" : ""}`}
    >
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
              disabled={disabled}
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

/**
 * A domain/profiel checkbox axis — grouped by sector (and, for vo, by track),
 * collapsed by default. The stored value is a flat slug set (`name="domains"`), so
 * a slug shared across tracks (e.g. groen) appears once per group with a unique id
 * derived from `idPrefix`; a null assignment = all checked. Reused for the
 * instance axis (`idPrefix="instance"`) and each teacher.
 */
function DomainAxis({
  idPrefix,
  domainSectors,
  assigned,
  legend,
  hint,
  emptyLabel,
  sectorLabel,
  trackHeading,
  locale,
  disabled,
}: {
  idPrefix: string;
  domainSectors: { sector: string; groups: DomainGroup[] }[];
  assigned: string[] | null;
  legend: string;
  hint: string;
  emptyLabel: string;
  sectorLabel: (s: string) => string;
  trackHeading: (s: string, tracks: string[]) => string;
  locale: Locale;
  disabled?: boolean;
}) {
  const isChecked = (v: string) => assigned === null || assigned.includes(v);
  return (
    <fieldset
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${disabled ? "opacity-60" : ""}`}
    >
      <legend className="px-1 text-sm font-semibold text-slate-800">{legend}</legend>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {domainSectors.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{emptyLabel}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {domainSectors.map((ds) => (
            <details
              key={ds.sector}
              className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
            >
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                {sectorLabel(ds.sector)}
              </summary>
              <div className="mt-2 space-y-3">
                {ds.groups.map((g) => {
                  const groupKey = g.tracks.join("_") || "all";
                  const heading = g.tracks.length ? trackHeading(ds.sector, g.tracks) : null;
                  const boxes = g.domains.map((d) => {
                    const id = `${idPrefix}-domain-${ds.sector}-${groupKey}-${d.value}`;
                    return (
                      <li key={id} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={id}
                          name="domains"
                          value={d.value}
                          defaultChecked={isChecked(d.value)}
                          disabled={disabled}
                          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                        />
                        <label htmlFor={id} className="text-sm text-slate-800">
                          {loc(d.label, locale)}
                        </label>
                      </li>
                    );
                  });
                  return heading ? (
                    <fieldset key={groupKey} className="rounded-md border border-slate-200 p-2">
                      <legend className="px-1 text-xs font-semibold text-slate-600">
                        {heading}
                      </legend>
                      <ul className="mt-1 list-none space-y-2 p-0">{boxes}</ul>
                    </fieldset>
                  ) : (
                    <ul key={groupKey} className="list-none space-y-2 p-0">
                      {boxes}
                    </ul>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}
    </fieldset>
  );
}

type TeacherRow = {
  id: string;
  name: string | null;
  email: string | null;
  customAccess: boolean;
  countries: string[] | null;
  sectors: string[] | null;
  domains: string[] | null;
};
type DomainSectorGroups = { sector: string; groups: DomainGroup[] };

/**
 * One teacher's custom-access form. The activate toggle is client state: while it
 * is off the three axis controls are disabled (so they can't be edited and don't
 * POST) and an "inherits the instance" note shows; the action treats a submit
 * without the toggle as a non-destructive deactivate.
 */
function TeacherAccessForm({
  teacher,
  countries,
  sectors,
  domainCatalogueSectors,
  locale,
  c,
}: {
  teacher: TeacherRow;
  countries: { id: CountryCode }[];
  sectors: { id: Sector }[];
  domainCatalogueSectors: DomainSectorGroups[];
  locale: Locale;
  c: ReturnType<typeof useT>["admin"]["context"];
}) {
  const [activated, setActivated] = useState(teacher.customAccess);
  return (
    <Form method="post" aria-labelledby={`teacher-${teacher.id}-heading`}>
      <input type="hidden" name="intent" value="teacher" />
      <input type="hidden" name="userId" value={teacher.id} />
      <div>
        <h4 id={`teacher-${teacher.id}-heading`} className="text-sm font-semibold text-slate-900">
          {teacher.name}
        </h4>
        {teacher.email && <p className="text-xs text-slate-500">{teacher.email}</p>}
      </div>
      <label className="mt-3 flex items-center gap-2.5">
        <input
          type="checkbox"
          name="customAccess"
          value="1"
          checked={activated}
          onChange={(e) => setActivated(e.target.checked)}
          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
        />
        <span className="text-sm font-medium text-slate-800">{c.activateLabel}</span>
      </label>
      {!activated && <p className="mt-1 text-xs text-slate-500">{c.inheritsNote}</p>}
      <div className="mt-3 space-y-4">
        <CheckAxis
          legend={c.countriesLegend}
          name="countries"
          idPrefix={`teacher-${teacher.id}-country`}
          disabled={!activated}
          options={countries.map((x) => ({
            id: x.id,
            label: countryLabelFor(x.id, locale),
            checked: isAssigned(teacher.countries, x.id),
          }))}
        />
        <CheckAxis
          legend={c.sectorsLegend}
          name="sectors"
          idPrefix={`teacher-${teacher.id}-sector`}
          disabled={!activated}
          options={sectors.map((x) => ({
            id: x.id,
            label: sectorLabelFor(x.id, locale),
            checked: isAssigned(teacher.sectors, x.id),
          }))}
        />
        <DomainAxis
          idPrefix={`teacher-${teacher.id}`}
          domainSectors={domainCatalogueSectors}
          assigned={teacher.domains}
          legend={c.domainsLegend}
          hint={c.domainsHint}
          emptyLabel={c.domainsNone}
          sectorLabel={(s) => sectorLabelStrFor(s, locale)}
          trackHeading={(s, tr) => trackHeadingFor(s, tr, locale)}
          locale={locale}
          disabled={!activated}
        />
      </div>
      <Button type="submit" className="mt-4">
        {c.save}
      </Button>
    </Form>
  );
}

export default function AdminContext({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { countries, sectors, enabledDomains, domainCatalogueSectors, teachers } = loaderData;
  const c = t.admin.context;

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
              label: countryLabelFor(x.id, locale),
              checked: x.checked,
            }))}
          />
          <CheckAxis
            legend={c.sectorsLegend}
            name="sectors"
            idPrefix="instance-sector"
            options={sectors.map((x) => ({
              id: x.id,
              label: sectorLabelFor(x.id, locale),
              checked: x.checked,
            }))}
          />
          <DomainAxis
            idPrefix="instance"
            domainSectors={domainCatalogueSectors}
            assigned={enabledDomains}
            legend={c.instanceDomainsLegend}
            hint={c.instanceDomainsHint}
            emptyLabel={c.domainsNone}
            sectorLabel={(s) => sectorLabelStrFor(s, locale)}
            trackHeading={(s, tr) => trackHeadingFor(s, tr, locale)}
            locale={locale}
          />
        </div>
        <Button type="submit" className="mt-4">
          {c.save}
        </Button>
      </Form>

      {/* Per-teacher custom access. */}
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
                <TeacherAccessForm
                  teacher={teacher}
                  countries={countries}
                  sectors={sectors}
                  domainCatalogueSectors={domainCatalogueSectors}
                  locale={locale}
                  c={c}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
