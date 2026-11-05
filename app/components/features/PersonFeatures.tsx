import type { Choice, Decision } from "~/lib/features/rule";
import type { LocalizedText } from "~/lib/i18n/localized";
import { loc } from "~/lib/i18n/localized";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { ChoiceSelect } from "./selects";

/** One feature or tool on the person page (P28.3). */
export interface FeatureRow {
  key: string;
  kind: "feature" | "tool";
  name: LocalizedText;
  on: boolean;
  source: Decision["source"];
  team: string | null;
  exception: Choice | null;
  /** Off on the instance: an exception cannot switch it on, so there is no select. */
  instanceOff: boolean;
}

const th = "px-4 py-2.5 font-semibold";

/**
 * "Parts and tools" on the person page: what this teacher has now, where it comes from
 * (setting, via team X, exception, off on the instance) and the admin's exception.
 */
export function PersonFeatures({
  rows,
  errorMessage,
}: {
  rows: FeatureRow[];
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const f = t.features;
  const parts = rows.filter((r) => r.kind === "feature");
  const tools = rows.filter((r) => r.kind === "tool");
  return (
    <section aria-labelledby="person-features">
      <h2
        id="person-features"
        className="font-display text-lg font-medium tracking-tight text-slate-900"
      >
        {f.personHeading}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{f.personIntro}</p>
      <FeatureTable caption={f.featuresHeading} rows={parts} errorMessage={errorMessage} />
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          {f.personTools} ({tools.filter((r) => r.on).length}/{tools.length})
        </summary>
        <FeatureTable caption={f.personTools} rows={tools} errorMessage={errorMessage} />
      </details>
    </section>
  );
}

function FeatureTable({
  caption,
  rows,
  errorMessage,
}: {
  caption: string;
  rows: FeatureRow[];
  errorMessage: (code: string | true) => string | undefined;
}) {
  const t = useT();
  const locale = useLocale();
  const f = t.features;
  const sourceText = (r: FeatureRow) =>
    r.source === "team"
      ? fmt(f.sourceTeam, { name: r.team ?? "" })
      : {
          admin: f.sourceAdmin,
          default: f.sourceDefault,
          exception: f.sourceException,
          instance: f.sourceInstance,
        }[r.source];
  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className={th}>
              {f.colFeature}
            </th>
            <th scope="col" className={th}>
              {f.effectiveLabel}
            </th>
            <th scope="col" className={th}>
              <span className="sr-only">{f.exceptionNone}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = loc(r.name, locale);
            return (
              <tr key={r.key} className="border-b border-slate-50 last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-slate-800">
                  {name}
                </th>
                <td className="px-4 py-2.5">
                  <span
                    className={
                      r.on
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                    }
                  >
                    {r.on ? f.stateOn : f.stateOff}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">{sourceText(r)}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {!r.instanceOff && (
                    <AutoSaveForm
                      intent="exception"
                      hidden={{ key: r.key }}
                      errorMessage={errorMessage}
                    >
                      <ChoiceSelect
                        name="choice"
                        label={fmt(f.exceptionLabel, { name })}
                        defaultValue={r.exception ?? undefined}
                        noneLabel={f.exceptionNone}
                        onLabel={f.exceptionOn}
                        offLabel={f.exceptionOff}
                      />
                    </AutoSaveForm>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
