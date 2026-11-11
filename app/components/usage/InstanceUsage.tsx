import type { UsageSums } from "~/lib/usage/summary";
import { fmt } from "~/lib/i18n/format";
import type { LocalizedText } from "~/lib/i18n/localized";
import { useT } from "~/lib/i18n/useT";
import { Figure, Figures, UsageTable, WeekBars, useUsageFormat } from "./UsageParts";

type Group = { key: string; label: string | null } & UsageSums;
/** A model or provider group: its label is the provider's (possibly bilingual) name. */
type ProviderGroup = Omit<Group, "label"> & { label: string | LocalizedText | null };

export interface InstanceData {
  total: UsageSums;
  cacheShare: number | null;
  weeks: { week: string; calls: number; costMicros: number }[];
  users: Group[];
  teams: Group[];
  sources: Group[];
  models: (ProviderGroup & { name: string })[];
  providers: ProviderGroup[];
}

export interface MoneyData {
  currentMonth: boolean;
  forecastMicros: number;
  savingsMicros: number;
}

/** The admin's circle: everyone, per person, team, tool and model, with costs. */
export function InstanceUsage({ data, money }: { data: InstanceData; money: MoneyData | null }) {
  const t = useT();
  const f = useUsageFormat();
  const s = data.total;
  const calls = {
    label: t.usage.colCalls,
    cell: (r: UsageSums) => f.number(r.calls),
    numeric: true,
  };
  const cost = {
    label: t.usage.colCost,
    cell: (r: UsageSums) => f.euro(r.costMicros),
    numeric: true,
  };
  const input = {
    label: t.usage.colInput,
    cell: (r: UsageSums) => f.number(r.inputTokens),
    numeric: true,
  };
  const cacheRead = {
    label: t.usage.colCacheRead,
    cell: (r: UsageSums) => f.number(r.cacheReadTokens),
    numeric: true,
  };
  const output = {
    label: t.usage.colOutput,
    cell: (r: UsageSums) => f.number(r.outputTokens),
    numeric: true,
  };

  return (
    <section aria-labelledby="usage-all" className="space-y-4">
      <div>
        <h2
          id="usage-all"
          className="font-display text-lg font-medium tracking-tight text-slate-900"
        >
          {t.usage.allHeading}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t.usage.allIntro}</p>
      </div>

      <Figures>
        <Figure label={t.usage.callsMonth} value={f.number(s.calls)} />
        <Figure
          label={t.usage.cost}
          value={f.euro(s.costMicros)}
          note={
            s.unpricedCalls === 1
              ? t.usage.unpricedOne
              : s.unpricedCalls > 1
                ? fmt(t.usage.unpriced, { n: s.unpricedCalls })
                : undefined
          }
        />
        <Figure
          label={t.usage.tokens}
          value={f.number(s.inputTokens + s.cacheReadTokens + s.cacheWriteTokens + s.outputTokens)}
          note={fmt(t.usage.tokensLine, {
            input: f.number(s.inputTokens + s.cacheWriteTokens),
            cache: f.number(s.cacheReadTokens),
            output: f.number(s.outputTokens),
          })}
        />
        <Figure label={t.usage.cacheShare} value={f.percent(data.cacheShare)} />
        {s.failedCalls > 0 && <Figure label={t.usage.failed} value={f.number(s.failedCalls)} />}
      </Figures>

      {money && (
        <section aria-labelledby="usage-owner" className="space-y-3">
          <h3 id="usage-owner" className="text-sm font-semibold text-slate-900">
            {t.usage.ownerHeading}
          </h3>
          <Figures>
            <Figure
              label={money.currentMonth ? t.usage.forecast : t.usage.monthTotal}
              value={f.euro(money.forecastMicros)}
            />
            <Figure
              label={t.usage.savings}
              value={f.euro(money.savingsMicros)}
              note={t.usage.savingsNote}
            />
          </Figures>
        </section>
      )}

      <p className="text-xs text-slate-500">{t.usage.estimate}</p>

      <WeekBars weeks={data.weeks} />

      <UsageTable
        caption={t.usage.perPerson}
        rows={data.users}
        columns={[
          { label: t.usage.colPerson, cell: (r) => r.label ?? r.key },
          calls,
          input,
          cacheRead,
          output,
          cost,
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <UsageTable
          caption={t.usage.perTeam}
          rows={data.teams}
          columns={[{ label: t.usage.colTeam, cell: (r) => r.label ?? r.key }, calls, cost]}
        />
        <UsageTable
          caption={t.usage.perProvider}
          rows={data.providers}
          columns={[
            { label: t.usage.colProvider, cell: (r) => f.text(r.label ?? r.key) },
            calls,
            cost,
          ]}
        />
      </div>
      <UsageTable
        caption={t.usage.perModel}
        rows={data.models}
        columns={[
          { label: t.usage.colModel, cell: (r) => r.name },
          { label: t.usage.colProvider, cell: (r) => (r.label ? f.text(r.label) : "—") },
          calls,
          input,
          cacheRead,
          {
            label: t.usage.colCacheWrite,
            cell: (r) => f.number(r.cacheWriteTokens),
            numeric: true,
          },
          output,
          cost,
        ]}
      />
      <UsageTable
        caption={t.usage.perTool}
        rows={data.sources}
        columns={[{ label: t.usage.colTool, cell: (r) => f.source(r.key) }, calls, cost]}
      />
    </section>
  );
}
