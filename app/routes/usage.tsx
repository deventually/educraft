import { Form } from "react-router";
import type { Route } from "./+types/usage";
import { requireUser } from "~/server/auth.server";
import { loadUsageDashboard } from "~/server/usageDashboard.server";
import { setLimitFromForm } from "~/server/aiLimitsAdmin.server";
import { HelpLink } from "~/components/HelpLink";
import { Button, Label, Select } from "~/components/ui";
import { InstanceUsage } from "~/components/usage/InstanceUsage";
import { LimitNotice, useLimitScope } from "~/components/usage/LimitNotice";
import { LimitsAdmin } from "~/components/usage/LimitsAdmin";
import {
  CallTables,
  Figure,
  Figures,
  WeekBars,
  useUsageFormat,
} from "~/components/usage/UsageParts";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { MIN_TEAM_BREAKDOWN } from "~/lib/usage/summary";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.usage.heading} — ${m.appName}` }];
}

/** Setting a limit (PR D): an admin per team and teacher, the owner the budget. */
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const result = await setLimitFromForm(user, await request.formData());
  if (!result) throw new Response("Bad Request", { status: 400 });
  return result;
}

/** Everyone's page; `loadUsageDashboard` decides which circles the viewer sees. */
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  return loadUsageDashboard(user, new URL(request.url).searchParams.get("month"));
}

export default function Usage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const f = useUsageFormat();
  const { own, teams, instance, money, limits, month, months } = loaderData;
  const scopeOf = useLimitScope();

  return (
    <div className="w-full min-w-0 space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
            {t.usage.heading}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.usage.intro}</p>
          <HelpLink topic="usage" />
        </div>
        <Form method="get" className="flex items-end gap-2">
          <div>
            <Label htmlFor="usage-month">{t.usage.monthLabel}</Label>
            <Select id="usage-month" name="month" defaultValue={month} className="w-auto">
              {months.map((m) => (
                <option key={m} value={m}>
                  {f.month(m)}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="secondary">
            {t.usage.monthShow}
          </Button>
        </Form>
      </header>

      <section aria-labelledby="usage-own" className="space-y-4">
        <h2
          id="usage-own"
          className="font-display text-lg font-medium tracking-tight text-slate-900"
        >
          {t.usage.ownHeading}
        </h2>
        <Figures>
          <Figure label={t.usage.callsMonth} value={f.number(own.calls)} />
          <Figure
            label={t.usage.quotaLeft}
            value={
              own.quota
                ? fmt(t.usage.quotaOf, {
                    left: Math.max(0, own.quota.limit - own.quota.used),
                    limit: own.quota.limit,
                  })
                : t.usage.noLimit
            }
          />
          {own.limit && (
            <Figure
              label={t.usage.limitUsed}
              value={f.percent(own.limit.share)}
              note={scopeOf(own.limit)}
            />
          )}
          {own.failedCalls > 0 && (
            <Figure label={t.usage.failed} value={f.number(own.failedCalls)} />
          )}
        </Figures>
        <LimitNotice limit={own.limit} />
        <WeekBars weeks={own.weeks} />
        {own.calls === 0 ? (
          <p className="text-sm text-slate-500">{t.usage.none}</p>
        ) : (
          <CallTables sources={own.sources} models={own.models} />
        )}
      </section>

      {teams.map((team) => (
        <section key={team.id} aria-labelledby={`usage-team-${team.id}`} className="space-y-4">
          <div>
            <h2
              id={`usage-team-${team.id}`}
              className="font-display text-lg font-medium tracking-tight text-slate-900"
            >
              {fmt(t.usage.teamHeading, { name: team.name })}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t.usage.teamIntro}</p>
          </div>
          <Figures>
            <Figure label={t.usage.callsMonth} value={f.number(team.calls)} />
            <Figure label={t.usage.activeMembers} value={f.number(team.activeMembers)} />
          </Figures>
          <WeekBars weeks={team.weeks} />
          {team.activeMembers < MIN_TEAM_BREAKDOWN ? (
            <p className="text-sm text-slate-600">{t.usage.smallTeam}</p>
          ) : (
            <CallTables sources={team.sources} models={team.models} />
          )}
        </section>
      ))}

      {instance && <InstanceUsage data={instance} money={money} />}
      {limits && <LimitsAdmin data={limits} />}
    </div>
  );
}
