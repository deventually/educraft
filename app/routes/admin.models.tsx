import { Form, useActionData } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/admin.models";
import { requireRole } from "~/server/auth.server";
import { listModels } from "~/lib/ai/models";
import { getEnabledModels, setEnabledModels } from "~/server/repositories/settings.server";
import { useT } from "~/lib/i18n/useT";
import { Button } from "~/components/ui";

/** The catalog models an admin can toggle: client-selectable, non-local. */
function selectableCatalog(): { id: string; displayName: string }[] {
  return listModels()
    .filter((m) => m.clientSelectable && !m.local)
    .map((m) => ({ id: m.id as string, displayName: m.displayName }));
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const enabled = await getEnabledModels();
  const rows = selectableCatalog().map((m) => ({
    ...m,
    checked: enabled === null || enabled.includes(m.id),
  }));
  return { rows };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const catalogIds = new Set(selectableCatalog().map((m) => m.id));
  const selected = fd
    .getAll("models")
    .map(String)
    .filter((id) => catalogIds.has(id));
  // Lockout guard at the boundary: an admin may not unselect everything.
  if (selected.length === 0) {
    return { error: true as const };
  }
  await setEnabledModels(selected);
  return { saved: true as const };
}

export default function AdminModels({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const { rows } = loaderData;

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {t.admin.models.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t.admin.models.intro}</p>

      {actionData?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {t.admin.models.atLeastOne}
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
        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-slate-800">
            {t.admin.models.available}
          </legend>
          <ul className="mt-2 space-y-2.5">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id={`model-${m.id}`}
                  name="models"
                  value={m.id}
                  defaultChecked={m.checked}
                  className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                />
                <label htmlFor={`model-${m.id}`} className="text-sm font-medium text-slate-800">
                  {m.displayName}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">{t.admin.models.localNote}</p>
        </fieldset>
        <Button type="submit" className="mt-4">
          {t.admin.models.save}
        </Button>
      </Form>
    </section>
  );
}
