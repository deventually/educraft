/**
 * The "Modellen" tab of the admin's models page: one card per model (state, use, upgrade /
 * finish / undo), the allow-list and adding a model. Each form reports through the toast;
 * nothing announces inline.
 */
import { useFetcher } from "react-router";
import { Badge, Button, Label, Select } from "~/components/ui";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { AddModelForm } from "~/components/admin/AddModelForm";
import {
  type ChoiceView,
  type ModelActionResult,
  type ModelView,
  type ProviderView,
  sectionHeading,
  useModelToast,
} from "~/components/admin/modelShared";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { cn } from "~/lib/utils";

const STATE_STYLE = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  retiring: "border-amber-200 bg-amber-50 text-amber-800",
  retired: "border-slate-200 bg-slate-100 text-slate-600",
} as const;

function ModelCard({ model, targets }: { model: ModelView; targets: ModelView[] }) {
  const t = useT();
  const locale = useLocale();
  const a = t.modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  useModelToast(fetcher.data);
  const busy = fetcher.state !== "idle";
  const stateLabel = {
    active: a.stateActive,
    retiring: a.stateRetiring,
    retired: a.stateRetired,
  }[model.state];
  const headingId = `model-${model.id.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const others = targets.filter((m) => m.id !== model.id);
  const successor = model.successor?.displayName ?? "";

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
        model.state === "retired" && "bg-slate-50",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={headingId} className="text-sm font-semibold text-slate-900">
            {model.displayName}
          </h3>
          <p className="text-xs text-slate-500">
            {loc(model.providerName, locale)}
            {model.added && ` · ${a.yourModel}`}
          </p>
        </div>
        <Badge className={cn("shrink-0 whitespace-nowrap", STATE_STYLE[model.state])}>
          {stateLabel}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-slate-600">
        {fmt(a.usage, {
          results: String(model.usage.results),
          people: String(model.usage.people),
          teams: String(model.usage.teams),
          tools: String(model.usage.tools),
        })}
      </p>

      {model.state === "active" && others.length > 0 && (
        <fetcher.Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="intent" value="upgrade" />
          <input type="hidden" name="from" value={model.id} />
          <div className="min-w-0 flex-1 sm:flex-none">
            <Label htmlFor={`${headingId}-to`} className="sr-only">
              {fmt(a.upgradeToLabel, { name: model.displayName })}
            </Label>
            <span aria-hidden className="block text-xs font-medium text-slate-600">
              {a.upgradeTo}
            </span>
            <Select
              id={`${headingId}-to`}
              name="to"
              required
              defaultValue=""
              className="mt-1 w-full sm:w-64"
            >
              {/* No preselected target: an upgrade is always a deliberate choice. */}
              <option value="" disabled>
                {a.chooseVersion}
              </option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            {a.upgrade}
          </Button>
        </fetcher.Form>
      )}

      {model.state === "retiring" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-700">{fmt(a.retiringNote, { successor })}</p>
          <p className="text-xs text-slate-500">{a.usageFollow}</p>
          <div className="flex flex-wrap gap-2">
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="finish" />
              <input type="hidden" name="id" value={model.id} />
              <Button type="submit" disabled={busy}>
                {a.finish}
              </Button>
            </fetcher.Form>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <input type="hidden" name="id" value={model.id} />
              <Button type="submit" variant="ghost" disabled={busy}>
                {a.cancel}
              </Button>
            </fetcher.Form>
          </div>
        </div>
      )}

      {model.state === "retired" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">{fmt(a.retiredNote, { successor })}</p>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="cancel" />
            <input type="hidden" name="id" value={model.id} />
            <Button type="submit" variant="ghost" size="sm" disabled={busy}>
              {a.restore}
            </Button>
          </fetcher.Form>
        </div>
      )}
    </li>
  );
}

function ModelList({ models }: { models: ModelView[] }) {
  const t = useT();
  const a = t.modelAdmin;
  const active = models.filter((m) => m.state === "active");
  // Being replaced first (they ask for a step), then in use, then phased out.
  const order = { retiring: 0, active: 1, retired: 2 } as const;
  const sorted = [...models].sort((x, y) => order[x.state] - order[y.state]);
  return (
    <section aria-labelledby="models-heading">
      <h2 id="models-heading" className={sectionHeading}>
        {a.heading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.intro}</p>
      <ul aria-label={a.modelsCaption} className="mt-4 grid max-w-3xl gap-3">
        {sorted.map((m) => (
          <ModelCard key={m.id} model={m} targets={active} />
        ))}
      </ul>
    </section>
  );
}

/** The instance allow-list (P14/P18): which models users may pick. Moved from Tools. */
function ModelAllowList({ choices }: { choices: ChoiceView[] }) {
  const t = useT();
  const m = t.admin.models;
  return (
    <section aria-labelledby="allow-heading">
      <h2 id="allow-heading" className={sectionHeading}>
        {m.available}
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
            const items = choices.filter((c) => c.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="mt-4 first:mt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <ul className="mt-2 space-y-2.5">
                  {items.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        id={`allow-${c.id}`}
                        name="models"
                        value={c.id}
                        defaultChecked={c.checked}
                        className="size-4 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
                      />
                      <label
                        htmlFor={`allow-${c.id}`}
                        className="text-sm font-medium text-slate-800"
                      >
                        {c.displayName}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {choices.some((c) => c.group !== "frontier") && (
            <p className="mt-4 text-xs text-slate-500">{m.localGroupHint}</p>
          )}
        </fieldset>
      </AutoSaveForm>
    </section>
  );
}

/** The "Modellen" tab: every model (upgrade, phase out), what teachers may pick, adding one. */
export function ModelsTab({
  providers,
  models,
  choices,
}: {
  providers: ProviderView[];
  models: ModelView[];
  choices: ChoiceView[];
}) {
  return (
    <>
      <ModelList models={models} />
      <ModelAllowList choices={choices} />
      <AddModelForm providers={providers} />
    </>
  );
}
