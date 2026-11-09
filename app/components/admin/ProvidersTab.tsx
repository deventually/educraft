/**
 * The "Aanbieders" tab of the admin's models page: API providers (connect, add, remove) and the
 * models on this computer. Each form reports through the toast; nothing announces inline.
 */
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { Badge, Button, Input, Label, Select } from "~/components/ui";
import {
  CheckField,
  type LocalView,
  type ModelActionResult,
  type ProviderView,
  sectionHeading,
  useModelToast,
} from "~/components/admin/modelShared";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { cn } from "~/lib/utils";

function ProviderList({ providers }: { providers: ProviderView[] }) {
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
            {p.added && <AddedProviderFooter provider={p} />}
          </li>
        ))}
      </ul>
      <AddProviderForm />
    </section>
  );
}

/** An added provider: where it points, and a way to remove it (refused while in use). */
function AddedProviderFooter({ provider }: { provider: ProviderView }) {
  const t = useT();
  const locale = useLocale();
  const a = t.modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  useModelToast(fetcher.data);
  const name = loc(provider.name, locale);
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
      <div className="min-w-0 text-xs text-slate-500">
        <span className="block">{a.providerOwn}</span>
        {provider.baseURL && (
          <span className="block break-all font-mono text-slate-600">{provider.baseURL}</span>
        )}
      </div>
      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="removeProvider" />
        <input type="hidden" name="id" value={provider.id} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={fetcher.state !== "idle"}
          aria-label={fmt(a.providerRemoveLabel, { name })}
        >
          {a.providerRemove}
        </Button>
      </fetcher.Form>
    </div>
  );
}

/** Add a provider: an API at an address. Its key setting is derived and stays in .env. */
function AddProviderForm() {
  const t = useT();
  const a = t.modelAdmin;
  const fetcher = useFetcher<ModelActionResult>();
  const formRef = useRef<HTMLFormElement>(null);
  useModelToast(fetcher.data);

  useEffect(() => {
    if (fetcher.data && "providerAdded" in fetcher.data && fetcher.data.providerAdded)
      formRef.current?.reset();
  }, [fetcher.data]);

  return (
    <fetcher.Form
      method="post"
      ref={formRef}
      aria-labelledby="add-provider-heading"
      className="mt-4 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="intent" value="addProvider" />
      <div>
        <h3 id="add-provider-heading" className="text-sm font-semibold text-slate-900">
          {a.providerAdd}
        </h3>
        <p className="mt-1 text-xs text-slate-500">{a.providerAddIntro}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="provider-name">{a.providerName}</Label>
          <Input
            id="provider-name"
            name="name"
            required
            maxLength={60}
            autoComplete="off"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="provider-api">{a.providerApi}</Label>
          <Select
            id="provider-api"
            name="api"
            defaultValue="openai-compatible"
            aria-describedby="provider-api-hint"
            className="mt-1"
          >
            <option value="openai-compatible">{a.providerApiCompat}</option>
            <option value="anthropic">{a.providerApiAnthropic}</option>
          </Select>
          <p id="provider-api-hint" className="mt-1 text-xs text-slate-500">
            {a.providerApiHint}
          </p>
        </div>
      </div>
      <div>
        <Label htmlFor="provider-url">{a.providerBaseUrl}</Label>
        <Input
          id="provider-url"
          name="baseURL"
          type="url"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="https://"
          aria-describedby="provider-url-hint"
          className="mt-1 font-mono"
        />
        <p id="provider-url-hint" className="mt-1 text-xs text-slate-500">
          {a.providerBaseUrlHint}
        </p>
      </div>
      <div>
        <Label htmlFor="provider-models-url">{a.providerModelsUrl}</Label>
        <Input
          id="provider-models-url"
          name="modelsUrl"
          type="url"
          autoComplete="off"
          spellCheck={false}
          className="mt-1 font-mono"
        />
      </div>
      <CheckField
        id="provider-no-key"
        name="noKey"
        label={a.providerNoKey}
        hint={a.providerNoKeyHint}
      />
      <Button type="submit" variant="secondary" disabled={fetcher.state !== "idle"}>
        {a.providerAdd}
      </Button>
    </fetcher.Form>
  );
}

/** CLI agents and local servers: always shown, usable only outside production. */
function LocalModels({ local }: { local: LocalView }) {
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

/** The "Aanbieders" tab: API providers (connect, add, remove) and the models on this computer. */
export function ProvidersTab({
  providers,
  local,
}: {
  providers: ProviderView[];
  local: LocalView;
}) {
  return (
    <>
      <ProviderList providers={providers} />
      <LocalModels local={local} />
    </>
  );
}
