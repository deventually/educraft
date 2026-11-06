import { useState } from "react";
import { useFetcher } from "react-router";
import type { Route } from "./+types/admin.tools";
import { requireRole } from "~/server/auth.server";
import { ALL_TOOLS } from "~/lib/registry";
import { FEATURES, isFeatureId } from "~/lib/features";
import { isInstanceStand, type InstanceStand } from "~/lib/features/rule";
import {
  getFeatureStands,
  getToolStands,
  setFeatureStand,
  setToolStand,
} from "~/server/repositories/settings.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { Badge, Button, Input, Label, Select } from "~/components/ui";
import { useActionToast } from "~/components/Toast";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { StandSelect } from "~/components/features/selects";
import { isModelIntent, modelAdminAction, modelAdminData } from "~/server/modelAdmin.server";
import { ModelManagement } from "~/components/admin/models";

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
  return { rows, features, ...(await modelAdminData()) };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  // ── Models: allow-list, add, upgrade, phase out ──────────────────────────────
  if (isModelIntent(intent)) return modelAdminAction(intent, fd);

  const stand = fd.get("stand");
  if (intent === "tool") {
    const slug = String(fd.get("slug") ?? "");
    if (!ALL_TOOLS.some((tl) => tl.slug === slug) || !isInstanceStand(stand)) {
      return { error: "invalid" as const };
    }
    await setToolStand(slug, stand);
    return { saved: true as const };
  }

  // ── Many tools at once: every tool the admin had on screen ─────────────────
  if (intent === "toolsBulk") {
    const known = new Set(ALL_TOOLS.map((tl) => tl.slug));
    const slugs = [...new Set(fd.getAll("slugs").map(String))].filter((s) => known.has(s));
    if (!isInstanceStand(stand) || slugs.length === 0) return { error: "invalid" as const };
    for (const slug of slugs) await setToolStand(slug, stand);
    return { saved: true as const, count: slugs.length };
  }

  if (intent === "feature") {
    const id = fd.get("id");
    if (!isFeatureId(id) || !isInstanceStand(stand)) return { error: "invalid" as const };
    await setFeatureStand(id, stand);
    return { saved: true as const };
  }

  return { error: "invalid" as const };
}

/** Set every shown tool to one stand; reports through a toast, like the autosave forms. */
function ToolsBulkForm({ slugs }: { slugs: string[] }) {
  const t = useT();
  const at = t.admin.tools;
  const f = t.features;
  const fetcher = useFetcher<{ saved?: true; count?: number; error?: string }>();
  useActionToast(fetcher.data, (d) =>
    d.error
      ? { variant: "error", message: t.error.invalidRequest }
      : {
          variant: "success",
          message:
            d.count === 1 ? at.bulkDoneOne : fmt(at.bulkDoneMany, { count: String(d.count) }),
        },
  );
  return (
    <fetcher.Form method="post" aria-label={at.bulkHeading} className="flex items-end gap-2">
      <input type="hidden" name="intent" value="toolsBulk" />
      {slugs.map((slug) => (
        <input key={slug} type="hidden" name="slugs" value={slug} />
      ))}
      <div>
        <Label htmlFor="tools-bulk-stand">{at.bulkSetTo}</Label>
        <Select id="tools-bulk-stand" name="stand" defaultValue="on" className="mt-1 w-auto">
          <option value="on">{f.on}</option>
          <option value="request">{f.request}</option>
          <option value="off">{f.off}</option>
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={slugs.length === 0}>
        {at.bulkApply}
      </Button>
    </fetcher.Form>
  );
}

export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows, features, providers, models, choices, local } = loaderData;
  const f = t.features;
  const at = t.admin.tools;
  // Find and filter on the page: the registry is small, so no round trip.
  const [find, setFind] = useState("");
  const [standFilter, setStandFilter] = useState("");
  const needle = find.trim().toLowerCase();
  const shown = rows.filter(
    (r) =>
      (!standFilter || r.stand === standFilter) &&
      (!needle || loc(r.name, locale).toLowerCase().includes(needle)),
  );
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

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48">
              <Label htmlFor="tools-find">{at.search}</Label>
              <Input
                id="tools-find"
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="tools-stand">{at.filterStand}</Label>
              <Select
                id="tools-stand"
                value={standFilter}
                onChange={(e) => setStandFilter(e.target.value)}
                className="mt-1 w-auto"
              >
                <option value="">{at.allStands}</option>
                <option value="on">{f.on}</option>
                <option value="request">{f.request}</option>
                <option value="off">{f.off}</option>
              </Select>
            </div>
          </div>
          <ToolsBulkForm slugs={shown.map((r) => r.slug)} />
        </div>

        {shown.length === 0 && <p className="mt-4 text-sm text-slate-500">{at.noMatch}</p>}
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
              {shown.map((r) => {
                const name = loc(r.name, locale);
                return (
                  // Keyed on the saved stand: after "set every shown tool" the select
                  // shows the new stand (an uncontrolled select keeps its first value).
                  <tr
                    key={`${r.slug}-${r.stand}`}
                    className="border-b border-slate-50 last:border-0"
                  >
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

      <ModelManagement providers={providers} models={models} choices={choices} local={local} />
    </div>
  );
}
