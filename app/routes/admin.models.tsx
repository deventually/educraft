import { Form, useActionData } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/admin.models";
import { requireRole } from "~/server/auth.server";
import { listModels } from "~/lib/ai/models";
import { discoverLocalModels } from "~/lib/ai/discover.server";
import { getEnabledModels, setEnabledModels } from "~/server/repositories/settings.server";
import {
  getUserAssignedModels,
  getUserById,
  listUsers,
  setUserAssignedModels,
} from "~/server/repositories/users.server";
import { useT } from "~/lib/i18n/useT";
import { Button } from "~/components/ui";

/** Which section a model belongs to in the UI (P14): frontier API, CLI agent, or
 *  a locally-discovered (Ollama/LM Studio) model. */
type ModelGroup = "frontier" | "cli" | "local";
type CatalogModel = { id: string; displayName: string; group: ModelGroup };

/**
 * Every model an admin can curate (P14) — client-selectable only (Opus-class stays
 * server-side), across all origins: static frontier + CLI agents, plus any local
 * model discovered at runtime. Since P14 local/CLI are curatable here (not "always
 * on"); discovery is env-specific, so a model absent from this list is simply not
 * running right now.
 */
async function fullCatalog(): Promise<CatalogModel[]> {
  const staticModels: CatalogModel[] = listModels()
    .filter((m) => m.clientSelectable)
    .map((m) => ({
      id: m.id as string,
      displayName: m.displayName,
      group: m.local ? "cli" : "frontier",
    }));
  const discovered: CatalogModel[] = (await discoverLocalModels()).map((m) => ({
    id: m.id,
    displayName: m.displayName,
    group: "local",
  }));
  return [...staticModels, ...discovered];
}

/** The assignable base: the full catalog narrowed to the instance's allow-list. */
function assignableBase(catalog: CatalogModel[], enabled: string[] | null): CatalogModel[] {
  return catalog.filter((m) => enabled === null || enabled.includes(m.id));
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, "admin");
  const enabled = await getEnabledModels();
  const catalog = await fullCatalog();
  const rows = catalog.map((m) => ({
    ...m,
    checked: enabled === null || enabled.includes(m.id),
  }));
  // Per-teacher assignment (P13): checkboxes iterate the instance-enabled base;
  // a teacher's saved subset pre-checks, null (unset) = inherit = all checked.
  const base = assignableBase(catalog, enabled).map((m) => ({
    id: m.id,
    displayName: m.displayName,
  }));
  const allUsers = await listUsers();
  const teachers = await Promise.all(
    allUsers
      .filter((u) => u.role === "teacher")
      .map(async (u) => {
        const models = await getUserAssignedModels(u.id);
        return { id: u.id, name: u.name, email: u.email, models: models ? [...models] : null };
      }),
  );
  return { rows, base, teachers };
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, "admin");
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "instance");

  const catalog = await fullCatalog();

  // ── Per-teacher assignment (P13): intersect, never widens the instance ──────
  if (intent === "teacher") {
    const userId = String(fd.get("userId") ?? "");
    const target = await getUserById(userId);
    if (target?.role !== "teacher") throw new Response("Not found", { status: 404 });
    const enabled = await getEnabledModels();
    const baseIds = assignableBase(catalog, enabled).map((m) => m.id);
    const selected = [
      ...new Set(
        fd
          .getAll("models")
          .map(String)
          .filter((id) => baseIds.includes(id)),
      ),
    ];
    // Empty OR all-of-base = inherit (null); a strict subset narrows. Never a
    // lockout — a teacher always falls back to at least the instance base.
    const restrict = selected.length === 0 || selected.length === baseIds.length ? null : selected;
    await setUserAssignedModels(userId, restrict);
    return { saved: true as const };
  }

  // ── Instance allow-list: frontier + CLI + discovered local (P14) ────────────
  const catalogIds = new Set(catalog.map((m) => m.id));
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

type ModelBox = { id: string; displayName: string };
type TeacherRow = {
  id: string;
  name: string | null;
  email: string | null;
  models: string[] | null;
};

/** One checkbox per model in `base`, pre-checked by `checkedIds` (null = all). */
function ModelCheckboxes({
  idPrefix,
  base,
  checkedIds,
}: {
  idPrefix: string;
  base: ModelBox[];
  checkedIds: string[] | null;
}) {
  const isChecked = (id: string) => checkedIds === null || checkedIds.includes(id);
  return (
    <ul className="mt-2 space-y-2.5">
      {base.map((m) => (
        <li key={m.id} className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id={`${idPrefix}-${m.id}`}
            name="models"
            value={m.id}
            defaultChecked={isChecked(m.id)}
            className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
          />
          <label htmlFor={`${idPrefix}-${m.id}`} className="text-sm font-medium text-slate-800">
            {m.displayName}
          </label>
        </li>
      ))}
    </ul>
  );
}

/** One teacher's model-assignment form (checkboxes over the instance base). */
function TeacherModelForm({
  teacher,
  base,
  save,
}: {
  teacher: TeacherRow;
  base: ModelBox[];
  save: string;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value="teacher" />
      <input type="hidden" name="userId" value={teacher.id} />
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <legend className="px-1 text-sm font-semibold text-slate-800">{teacher.name}</legend>
        {teacher.email && <p className="text-xs text-slate-500">{teacher.email}</p>}
        <ModelCheckboxes
          idPrefix={`teacher-${teacher.id}-model`}
          base={base}
          checkedIds={teacher.models}
        />
      </fieldset>
      <Button type="submit" className="mt-3">
        {save}
      </Button>
    </Form>
  );
}

export default function AdminModels({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const actionData = useActionData<typeof action>();
  const { rows, base, teachers } = loaderData;
  const m = t.admin.models;

  return (
    <section>
      <h2 className="font-display text-lg font-medium tracking-tight text-slate-900">
        {m.heading}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{m.intro}</p>

      {actionData?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {m.atLeastOne}
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
        <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <legend className="px-1 text-sm font-semibold text-slate-800">{m.available}</legend>
          {(
            [
              { group: "frontier", label: m.frontierGroup },
              { group: "cli", label: m.cliGroup },
              { group: "local", label: m.localGroup },
            ] as const
          ).map(({ group, label }) => {
            const items = rows.filter((mdl) => mdl.group === group);
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
          <p className="mt-4 text-xs text-slate-500">{m.localGroupHint}</p>
        </fieldset>
        <Button type="submit" className="mt-4">
          {m.save}
        </Button>
      </Form>

      {/* Per-teacher model assignment (P13) — intersect, narrows the base only. */}
      <div className="mt-10 max-w-xl">
        <h3 className="font-display text-base font-medium tracking-tight text-slate-900">
          {m.teacherLegend}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{m.teacherIntro}</p>
        {teachers.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{m.teacherNone}</p>
        ) : (
          <ul className="mt-4 list-none space-y-6 p-0">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                <TeacherModelForm teacher={teacher} base={base} save={m.save} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
