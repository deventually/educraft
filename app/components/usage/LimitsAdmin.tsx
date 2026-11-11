import { AutoSaveForm } from "~/components/admin/AutoSaveForm";
import { Input } from "~/components/ui";
import { fmt } from "~/lib/i18n/format";
import { useLocale, useT } from "~/lib/i18n/useT";

interface Limit {
  id: string;
  name: string;
  euros: number | null;
}

export interface LimitsData {
  /** Only for the owner. */
  budget: { euros: number | null } | null;
  teams: Limit[];
  people: Limit[];
}

/**
 * The admin's limits (PR D): per team and per teacher, and the owner's budget. Each field
 * saves itself on blur or Enter (`AutoSaveForm`); empty removes the limit.
 */
export function LimitsAdmin({ data }: { data: LimitsData }) {
  const t = useT();
  const locale = useLocale();
  const amount = (euros: number | null) =>
    euros === null ? "" : euros.toLocaleString(locale === "en" ? "en-GB" : "nl-NL");
  const errorMessage = (code: string | true) =>
    typeof code === "string" ? (t.usage.errors as Record<string, string>)[code] : undefined;

  const field = (intent: string, limit: Limit) => (
    <AutoSaveForm intent={intent} hidden={{ id: limit.id }} errorMessage={errorMessage}>
      <Input
        name="euros"
        inputMode="decimal"
        defaultValue={amount(limit.euros)}
        placeholder={t.usage.limitNone}
        aria-label={fmt(t.usage.limitFor, { name: limit.name })}
        className="w-32 text-right"
      />
    </AutoSaveForm>
  );

  const list = (caption: string, intent: string, rows: Limit[]) =>
    rows.length === 0 ? null : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <caption className="px-4 pt-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {caption}
          </caption>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <th scope="row" className="px-4 py-2 font-medium text-slate-800">
                  {r.name}
                </th>
                <td className="px-4 py-2 text-right">{field(intent, r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <section aria-labelledby="usage-limits" className="space-y-4">
      <div>
        <h3 id="usage-limits" className="text-sm font-semibold text-slate-900">
          {t.usage.limitAdmin.heading}
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{t.usage.limitAdmin.intro}</p>
      </div>
      {data.budget && (
        <AutoSaveForm intent="budget" errorMessage={errorMessage}>
          <label htmlFor="usage-budget" className="block text-sm font-medium text-slate-800">
            {t.usage.budgetLabel}
          </label>
          <Input
            id="usage-budget"
            name="euros"
            inputMode="decimal"
            defaultValue={amount(data.budget.euros)}
            placeholder={t.usage.limitNone}
            className="mt-1 w-40 text-right"
          />
        </AutoSaveForm>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {list(t.usage.limitAdmin.teams, "teamLimit", data.teams)}
        {list(t.usage.limitAdmin.people, "userLimit", data.people)}
      </div>
    </section>
  );
}
