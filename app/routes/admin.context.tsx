import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.context";
import { requireRole } from "~/server/auth.server";
import {
  getEnabledSectors,
  getEnabledDomains,
  setEnabledSectors,
  setEnabledDomains,
} from "~/server/repositories/settings.server";
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
import { useFormToast } from "~/components/Toast";
import { Button } from "~/components/ui";

/**
 * Sector/domain availability write UI: an admin toggles which sectors and
 * domains/profielen the instance offers. Every teacher and admin follows this
 * selection (P18) — there is no per-teacher access and no country axis. Lockout
 * guard: sectors may not be emptied; domains may (that means "all").
 *
 * `null` (unset) = all, so a fresh instance is unchanged and needs no migration
 * (every key lives in `instance_settings`).
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const [enabledSectors, enabledDomains] = await Promise.all([
    getEnabledSectors(),
    getEnabledDomains(),
  ]);
  const sectors = SECTORS.map((id) => ({
    id,
    checked: enabledSectors === null || enabledSectors.includes(id),
  }));
  // The shared domain catalogue: only the sectors that actually carry a profiel
  // catalogue (vo, hbo) — mbo/wo use custom fields.
  const domainCatalogueSectors = SECTORS.map((s) => ({
    sector: s as string,
    groups: domainGroupsForSector("NL", s),
  })).filter((ds) => ds.groups.length > 0);
  return { sectors, enabledDomains, domainCatalogueSectors };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  // Never trust the body: keep only shipped catalogue codes on every axis.
  const sectors = fd.getAll("sectors").map(String).filter(isSector);
  const knownDomains = new Set(allDomainValues("NL"));
  const domains = fd
    .getAll("domains")
    .map(String)
    .filter((d) => knownDomains.has(d));

  if (intent === "instance") {
    // Lockout guard (mirrors admin.models): an admin may not empty the sectors.
    // Domains may be empty — that just means "all domains".
    if (sectors.length === 0) {
      return { error: "instance-empty" as const };
    }
    await setEnabledSectors(sectors);
    await setEnabledDomains(domains.length ? domains : null);
    return { saved: true as const };
  }

  throw new Response("Bad request", { status: 400 });
}

// ── Locale-aware label helpers ──
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
/** One checkbox fieldset over a catalogue axis (sectors). */
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

/**
 * A domain/profiel checkbox axis — grouped by sector (and, for vo, by track),
 * collapsed by default. The stored value is a flat slug set (`name="domains"`), so
 * a slug shared across tracks (e.g. groen) appears once per group with a unique id
 * derived from `idPrefix`; a null assignment = all checked.
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
}) {
  const isChecked = (v: string) => assigned === null || assigned.includes(v);
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

export default function AdminContext({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { sectors, enabledDomains, domainCatalogueSectors } = loaderData;
  const c = t.admin.context;
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d
          ? { variant: "error", message: c.atLeastOne }
          : "saved" in d
            ? { variant: "success", message: t.admin.console.saved }
            : null,
  });

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
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{c.atLeastOne}</p>
      )}

      {/* Instance-level toggle — labelled by the page heading. */}
      <Form method="post" aria-labelledby="admin-context-heading" className="mt-2 max-w-xl">
        <input type="hidden" name="intent" value="instance" />
        <div className="space-y-4">
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
    </section>
  );
}
