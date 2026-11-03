import { Form, useActionData } from "react-router";
import type { Route } from "./+types/admin.tools";
import { requireRole } from "~/server/auth.server";
import { ALL_TOOLS } from "~/lib/registry";
import {
  getEnabledModels,
  setEnabledModels,
  getToolSetting,
  getToolSettings,
  setToolSetting,
} from "~/server/repositories/settings.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { useFormToast } from "~/components/Toast";
import { Badge, Button } from "~/components/ui";
import { fullCatalog } from "~/server/modelCatalog.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const settings = await getToolSettings();
  const map = new Map(settings.map((s) => [s.toolSlug, s]));
  const rows = ALL_TOOLS.map((tool) => {
    const s = map.get(tool.slug);
    return {
      slug: tool.slug,
      name: tool.name,
      userType: tool.userType,
      mode: tool.mode,
      phase: tool.phase,
      enabled: s?.enabled ?? tool.enabled, // effective
    };
  });
  // Instance model allow-list (P14/P18): `null` stored = every model is on.
  const enabled = await getEnabledModels();
  const models = (await fullCatalog()).map((m) => ({
    ...m,
    checked: enabled === null || enabled.includes(m.id),
  }));
  return { rows, models };
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

  if (intent === "tool") {
    const slug = String(fd.get("slug") ?? "");
    if (!ALL_TOOLS.some((tl) => tl.slug === slug)) {
      return { error: "invalid" as const };
    }
    await setToolSetting(slug, { enabled: fd.get("enabled") === "on" });
    const saved = await getToolSetting(slug);
    return { savedSlug: slug, enabled: saved?.enabled ?? false };
  }

  return { error: "invalid" as const };
}

export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { rows, models } = loaderData;
  const m = t.admin.models;
  useFormToast(actionData, {
    result: (d) =>
      !d
        ? null
        : "error" in d
          ? { variant: "error", message: d.error === true ? m.atLeastOne : t.error.invalidRequest }
          : "saved" in d || "savedSlug" in d
            ? { variant: "success", message: t.admin.console.saved }
            : null,
  });
  return (
    <div className="space-y-10">
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
                  {t.admin.tools.enabledLabel}
                </th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">{t.admin.tools.save}</span>
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
                      <input
                        form={r.slug}
                        type="checkbox"
                        name="enabled"
                        defaultChecked={r.enabled}
                        aria-label={`${t.admin.tools.enabledLabel} — ${name}`}
                        className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Form method="post" id={r.slug}>
                        <input type="hidden" name="intent" value="tool" />
                        <input type="hidden" name="slug" value={r.slug} />
                        <Button type="submit" variant="secondary" size="sm">
                          {t.admin.tools.save}
                        </Button>
                      </Form>
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

        <Form method="post" className="mt-2 max-w-xl">
          <input type="hidden" name="intent" value="models" />
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
          <Button type="submit" className="mt-4">
            {m.save}
          </Button>
        </Form>
      </section>
    </div>
  );
}
