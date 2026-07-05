import { Form, useActionData } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/admin.tools";
import { requireRole } from "~/server/auth.server";
import { ALL_TOOLS } from "~/lib/registry";
import {
  getToolSetting,
  getToolSettings,
  setToolSetting,
} from "~/server/repositories/settings.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { Badge, Button, Select } from "~/components/ui";

const AUDIENCES = ["", "student", "instructor", "both"] as const;

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
      audienceOverride: s?.audienceOverride ?? "",
    };
  });
  return { rows };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const slug = String(fd.get("slug") ?? "");
  if (!ALL_TOOLS.some((tl) => tl.slug === slug)) {
    return { error: true as const };
  }
  const audienceRaw = String(fd.get("audience") ?? "");
  const audienceOverride = (AUDIENCES as readonly string[]).includes(audienceRaw)
    ? audienceRaw || null
    : null;
  await setToolSetting(slug, { enabled: fd.get("enabled") === "on", audienceOverride });
  const saved = await getToolSetting(slug);
  return { savedSlug: slug, enabled: saved?.enabled ?? false };
}

export default function AdminTools({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { rows } = loaderData;
  const audienceLabel: Record<string, string> = {
    "": t.admin.tools.audienceDefault,
    student: t.admin.tools.audienceStudent,
    instructor: t.admin.tools.audienceInstructor,
    both: t.admin.tools.audienceBoth,
  };

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {t.admin.tools.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.admin.tools.intro}</p>

      <p className="mt-3 h-5 text-sm text-emerald-700" aria-live="polite">
        {actionData?.savedSlug ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4" aria-hidden />
            {t.admin.console.saved}
          </span>
        ) : (
          ""
        )}
      </p>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
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
                {t.admin.tools.audienceLabel}
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
                    <label htmlFor={`audience-${r.slug}`} className="sr-only">
                      {t.admin.tools.audienceLabel} — {name}
                    </label>
                    <Select
                      id={`audience-${r.slug}`}
                      form={r.slug}
                      name="audience"
                      defaultValue={r.audienceOverride}
                      className="w-auto"
                    >
                      {AUDIENCES.map((a) => (
                        <option key={a || "default"} value={a}>
                          {audienceLabel[a]}
                        </option>
                      ))}
                    </Select>
                  </td>
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
  );
}
