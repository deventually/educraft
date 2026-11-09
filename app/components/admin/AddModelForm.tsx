/** Adding a model on the admin's models page: provider, API id, name and its settings. */
import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import { Button, Input, Label, Select } from "~/components/ui";
import {
  CheckField,
  type ModelActionResult,
  type ProviderView,
  sectionHeading,
  useModelToast,
} from "~/components/admin/modelShared";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";

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
