import type { Route } from "./+types/admin.tools";
import { requireRole } from "~/server/auth.server";
import { ALL_TOOLS } from "~/lib/registry";
import { FEATURES, isFeatureId } from "~/lib/features";
import { isInstanceStand, type InstanceStand } from "~/lib/features/rule";
import {
  getEnabledModels,
  setEnabledModels,
  getFeatureStands,
  getToolStands,
  setFeatureStand,
  setToolStand,
} from "~/server/repositories/settings.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { Badge } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { fullCatalog } from "~/server/modelCatalog.server";
import { StandSelect } from "~/components/features/selects";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  // The instance layer (P28.3): Off, On or On request, per tool and per feature.
  const stands = await getToolStands();
  const rows = ALL_TOOLS.map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    userType: tool.userType,
    mode: tool.mode,
    phase: tool.phase,
    stand: stands.get(tool.slug) ?? ((tool.enabled ? "on" : "off") as InstanceStand),
  }));
  const featureStands = await getFeatureStands();
  const features = FEATURES.map((f) => ({
    id: f.id,
    name: f.name,
    stand: featureStands[f.id] ?? f.defaultStand,
  }));
  // Instance model allow-list (P14/P18): `null` stored = every model is on.
  const enabled = await getEnabledModels();
  const models = (await fullCatalog()).map((m) => ({
    ...m,
    checked: enabled === null || enabled.includes(m.id),
  }));
  return { rows, features, models };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  // ── Instance model allow-list ──────────────────────────────────────────────
  if (intent === "models") {
    const catalogIds = new Set((await fullCatalog()).map((m) => m.id));
    const chosen = [...new Set(fd.getAll("models").map(String))].filter((id) => catalogIds.has(id));
    // Lockout guard at the boundary: an admin may not unselect everything.
    if (chosen.length === 0) return { error: true as const };
    await setEnabledModels(chosen);
    return { saved: true as const };
  }

  const stand = fd.get("stand");
  if (intent === "tool") {
    const slug = String(fd.get("slug") ?? "");
    if (!ALL_TOOLS.some((tl) => tl.slug === slug) || !isInstanceStand(stand)) {
      return { error: "invalid" as const };
    }
    await setToolStand(slug, stand);
    return { saved: true as const };
  }

  if (intent === "feature") {
    const id = fd.get("id");
    if (!isFeatureId(id) || !isInstanceStand(stand)) return { error: "invalid" as const };
    await setFeatureStand(id, stand);
    return { saved: true as const };
  }

  return { error: "invalid" as const };
}

export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows, features, models } = loaderData;
  const m = t.admin.models;
  const f = t.features;
  return (
    <div className="space-y-10">
      {/* ── Features: the large parts of the app (P28.3) ─────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {f.featuresHeading}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">{f.featuresIntro}</p>
        <div className="mt-4 max-w-xl overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{f.featuresCaption}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {f.colFeature}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {f.colStand}
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => {
                const name = loc(feature.name, locale);
                return (
                  <tr key={feature.id} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {name}
                    </th>
                    <td className="px-4 py-2.5">
                      <AutoSaveForm
                        intent="feature"
                        hidden={{ id: feature.id }}
                        errorMessage={() => t.error.invalidRequest}
                      >
                        <StandSelect
                          label={fmt(f.standLabel, { name })}
                          defaultValue={feature.stand}
                        />
                      </AutoSaveForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {t.admin.tools.heading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.admin.tools.intro}</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.admin.tools.caption}</caption>
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.tools.colName}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.tools.colMode}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {t.admin.tools.colPhase}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  {f.colStand}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const name = loc(r.name, locale);
                return (
                  <tr key={r.slug} className="border-b border-slate-50 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                      {name}
                      <span className="ml-2 align-middle">
                        <Badge>
                          {r.userType === "student"
                            ? t.admin.tools.audienceStudent
                            : t.admin.tools.audienceInstructor}
                        </Badge>
                      </span>
                    </th>
                    <td className="px-4 py-2.5 text-slate-600">
                      {r.mode === "chat" ? t.admin.tools.modeChat : t.admin.tools.modeOneShot}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{r.phase}</td>
                    <td className="px-4 py-2.5">
                      <AutoSaveForm
                        intent="tool"
                        hidden={{ slug: r.slug }}
                        errorMessage={() => t.error.invalidRequest}
                      >
                        <StandSelect label={fmt(f.standLabel, { name })} defaultValue={r.stand} />
                      </AutoSaveForm>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Instance model allow-list ─────────────────────────────────────── */}
      <section>
        <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
          {m.heading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{m.intro}</p>

        <AutoSaveForm intent="models" errorMessage={() => m.atLeastOne} className="mt-2 max-w-xl">
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <legend className="px-1 text-sm font-semibold text-slate-800">{m.available}</legend>
            {(
              [
                { group: "frontier", label: m.frontierGroup },
                { group: "cli", label: m.cliGroup },
                { group: "local", label: m.localGroup },
              ] as const
            ).map(({ group, label }) => {
              const items = models.filter((mdl) => mdl.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="mt-4 first:mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </p>
                  <ul className="mt-2 space-y-2.5">
                    {items.map((mdl) => (
                      <li key={mdl.id} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          id={`model-${mdl.id}`}
                          name="models"
                          value={mdl.id}
                          defaultChecked={mdl.checked}
                          className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                        />
                        <label
                          htmlFor={`model-${mdl.id}`}
                          className="text-sm font-medium text-slate-800"
                        >
                          {mdl.displayName}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {models.some((mdl) => mdl.group !== "frontier") && (
              <p className="mt-4 text-xs text-slate-500">{m.localGroupHint}</p>
            )}
          </fieldset>
        </AutoSaveForm>
      </section>
    </div>
  );
}
