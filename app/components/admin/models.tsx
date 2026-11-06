/**
 * The parts of the admin's models page: providers, adding a model, one card per model
 * (state, use, upgrade / finish / undo), and the allow-list. Each form reports through
 * the toast; nothing announces inline.
 */
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Badge, Button, Input, Label, Select } from "~/components/ui";
import { useActionToast } from "~/components/Toast";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { cn } from "~/lib/utils";

export interface ProviderView {
  id: string;
  name: LocalizedText;
  connected: boolean;
  setting: string;
  modelsUrl?: string;
  example: string;
}

export interface ModelView {
  id: string;
  displayName: string;
  providerName: LocalizedText;
  added: boolean;
  state: "active" | "retiring" | "retired";
  successor: { id: string; displayName: string } | null;
  usage: { results: number; people: number; teams: number; tools: number };
}

export interface ChoiceView {
  id: string;
  displayName: string;
  checked: boolean;
  group: "frontier" | "cli" | "local";
}

/** What the models actions return (the parts the page reads). */
export type ModelActionResult =
  | { added?: string; error?: string }
  | { upgraded?: { name: string; successor: string } }
  | { finished?: { name: string; successor: string } }
  | { cancelled?: { name: string; restored: boolean } }
  | { saved?: true; error?: string | true };

/** Toast every models action the same way: the done text, or the error text. */
function useModelToast(data: ModelActionResult | undefined) {
  const t = useT();
  const a = t.modelAdmin;
  useActionToast(data, (d) => {
    if ("error" in d && d.error) {
      const msg =
        typeof d.error === "string" ? a.error[d.error as keyof typeof a.error] : undefined;
      return { variant: "error", message: msg ?? t.error.invalidRequest };
    }
    if ("added" in d && d.added)
      return { variant: "success", message: fmt(a.addDone, { name: d.added }) };
    if ("upgraded" in d && d.upgraded)
      return { variant: "success", message: fmt(a.upgradeDone, d.upgraded) };
    if ("finished" in d && d.finished)
      return { variant: "success", message: fmt(a.finishDone, d.finished) };
    if ("cancelled" in d && d.cancelled) {
      const text = d.cancelled.restored ? a.restoreDone : a.cancelDone;
      return { variant: "success", message: fmt(text, { name: d.cancelled.name }) };
    }
    return null;
  });
}

const sectionHeading = "font-display text-lg font-medium tracking-tight text-slate-900";

export function ProviderList({ providers }: { providers: ProviderView[] }) {
  const t = useT();
  const locale = useLocale();
  const a = t.modelAdmin;
  return (
    <section aria-labelledby="providers-heading">
      <h2 id="providers-heading" className={sectionHeading}>
        {a.providersHeading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.providersIntro}</p>
      <ul aria-labelledby="providers-heading" className="mt-4 grid max-w-3xl gap-2 sm:grid-cols-2">
        {providers.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">{loc(p.name, locale)}</span>
              {p.connected ? (
                <Badge className="shrink-0 gap-1 whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {a.connected}
                </Badge>
              ) : (
                <Badge className="shrink-0 gap-1 whitespace-nowrap">
                  <CircleDashed className="size-3.5" aria-hidden />
                  {a.notConnected}
                </Badge>
              )}
            </div>
            {!p.connected && (
              <p className="mt-1.5 text-xs text-slate-500">
                {fmt(a.notConnectedHint, { setting: p.setting })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

const checkbox =
  "mt-0.5 size-4 shrink-0 rounded border-slate-300 text-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500";

function CheckField({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        type="checkbox"
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={checkbox}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function AddModelForm({ providers }: { providers: ProviderView[] }) {
  const t = useT();
  const locale = useLocale();
  const a = t.modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  useModelToast(fetcher.data);
  const connected = providers.filter((p) => p.connected);
  const first = connected[0];

  // A fresh result object per submission: clear the form after a success only.
  useEffect(() => {
    if (fetcher.data && "added" in fetcher.data && fetcher.data.added) formRef.current?.reset();
  }, [fetcher.data]);

  return (
    <section aria-labelledby="add-model-heading">
      <h2 id="add-model-heading" className={sectionHeading}>
        {a.addHeading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.addIntro}</p>
      {first ? (
        <fetcher.Form
          method="post"
          ref={formRef}
          aria-labelledby="add-model-heading"
          className="mt-4 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="intent" value="add" />
          <div>
            <Label htmlFor="add-provider">{a.provider}</Label>
            <Select id="add-provider" name="provider" defaultValue={first.id} className="mt-1">
              {connected.map((p) => (
                <option key={p.id} value={p.id}>
                  {loc(p.name, locale)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="add-api-id">{a.apiId}</Label>
              <Input
                id="add-api-id"
                name="apiId"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder={first.example}
                aria-describedby="add-api-id-hint"
                className="mt-1 font-mono"
              />
              <p id="add-api-id-hint" className="mt-1 text-xs text-slate-500">
                {fmt(a.apiIdHint, { example: first.example })}
              </p>
            </div>
            <div>
              <Label htmlFor="add-name">{a.displayName}</Label>
              <Input
                id="add-name"
                name="displayName"
                required
                autoComplete="off"
                maxLength={80}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="add-effort">{a.effort}</Label>
              <Select
                id="add-effort"
                name="effort"
                defaultValue=""
                aria-describedby="add-effort-hint"
                className="mt-1"
              >
                <option value="">{a.effortDefault}</option>
                {(["low", "medium", "high", "xhigh", "max"] as const).map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </Select>
              <p id="add-effort-hint" className="mt-1 text-xs text-slate-500">
                {a.effortHint}
              </p>
            </div>
            <div>
              <Label htmlFor="add-temperature">{a.temperature}</Label>
              <Input
                id="add-temperature"
                name="temperature"
                type="number"
                inputMode="decimal"
                min={0}
                max={2}
                step={0.1}
                aria-describedby="add-temperature-hint"
                className="mt-1"
              />
              <p id="add-temperature-hint" className="mt-1 text-xs text-slate-500">
                {a.temperatureHint}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <CheckField id="add-images" name="supportsImages" label={a.supportsImages} />
            <CheckField
              id="add-thinks"
              name="alwaysThinks"
              label={a.alwaysThinks}
              hint={a.alwaysThinksHint}
            />
            <CheckField
              id="add-selectable"
              name="clientSelectable"
              label={a.clientSelectable}
              hint={a.clientSelectableHint}
              defaultChecked
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="submit" disabled={fetcher.state !== "idle"}>
              {a.add}
            </Button>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {connected
                .filter((p) => p.modelsUrl)
                .map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.modelsUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-violet-700 underline underline-offset-2 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-violet-500"
                    >
                      {fmt(a.apiIdList, { provider: loc(p.name, locale) })}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        </fetcher.Form>
      ) : (
        <p className="mt-4 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {a.noConnected}
        </p>
      )}
    </section>
  );
}

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

export function ModelList({ models }: { models: ModelView[] }) {
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

export interface LocalView {
  enabled: boolean;
  agents: { id: string; displayName: string }[];
  servers: { id: string; name: string; found: number }[];
}

/** CLI agents and local servers: always shown, usable only outside production. */
export function LocalModels({ local }: { local: LocalView }) {
  const t = useT();
  const a = t.modelAdmin;
  const found = (n: number) =>
    n === 0 ? a.foundNone : n === 1 ? a.foundOne : fmt(a.foundMany, { count: String(n) });
  const item = "rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm";
  return (
    <section aria-labelledby="local-heading">
      <h2 id="local-heading" className={sectionHeading}>
        {a.localHeading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{a.localIntro}</p>
      {!local.enabled && (
        <p className="mt-3 max-w-xl rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {a.localOff}
        </p>
      )}
      <div className="mt-4 grid max-w-3xl gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {a.localServers}
          </h3>
          <ul className="mt-2 space-y-2">
            {local.servers.map((srv) => (
              <li key={srv.id} className={item}>
                <span className="block text-sm font-medium text-slate-800">{srv.name}</span>
                {local.enabled && (
                  <span className="text-xs text-slate-500">{found(srv.found)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {a.localAgents}
          </h3>
          <ul className="mt-2 space-y-2">
            {local.agents.map((agent) => (
              <li key={agent.id} className={cn(item, "text-sm font-medium text-slate-800")}>
                {agent.displayName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** The instance allow-list (P14/P18): which models users may pick. Moved from Tools. */
export function ModelAllowList({ choices }: { choices: ChoiceView[] }) {
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

/** The whole models part of "Tools and models": in use, add, providers, allow-list. */
export function ModelManagement({
  providers,
  models,
  choices,
  local,
}: {
  providers: ProviderView[];
  models: ModelView[];
  choices: ChoiceView[];
  local: LocalView;
}) {
  return (
    <>
      <ModelList models={models} />
      <AddModelForm providers={providers} />
      <ProviderList providers={providers} />
      <LocalModels local={local} />
      <ModelAllowList choices={choices} />
    </>
  );
}
