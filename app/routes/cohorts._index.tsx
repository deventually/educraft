import { Link } from "react-router";
import { BellRing, Plus, Users, Wrench } from "lucide-react";
import type { Route } from "./+types/cohorts._index";
import { requireRole } from "~/server/auth.server";
import {
  allowedSlugsOf,
  countCohortMembers,
  countPendingRemovals,
  listCohortsForManager,
} from "~/server/repositories/cohorts.server";
import { DEFAULT_LOCALE, getMessages, type Locale } from "~/lib/i18n";
import { fmt } from "~/lib/i18n/format";
import { useT, useLocale } from "~/lib/i18n/useT";
import { Badge, Card } from "~/components/ui";

export function meta({ matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
  const m = getMessages(root?.locale ?? DEFAULT_LOCALE);
  return [{ title: `${m.cohorts.title} — ${m.appName}` }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireRole(request, "teacher", "admin");
  // Cohorts a teacher manages: their own plus ones they're assigned to (Phase 4).
  const cohorts = await listCohortsForManager(user.id);
  const rows = await Promise.all(
    cohorts.map(async (c) => ({
      id: c.id,
      name: c.name,
      toolCount: allowedSlugsOf(c).size,
      memberCount: await countCohortMembers(c.id),
      // Pending account-removal requests to flag on the row (Phase 14).
      pendingRemovals: await countPendingRemovals(c.id),
      activeUntil: c.activeUntil,
    })),
  );
  return { rows };
}

export default function CohortsIndex({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { rows } = loaderData;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
            {t.cohorts.title}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t.cohorts.intro}</p>
        </div>
        <Link
          to="/cohorts/new"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <Plus className="size-4" aria-hidden />
          {t.cohorts.newCta}
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center text-sm text-slate-500">
          {t.cohorts.empty}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="p-0">
                <Link
                  to={`/cohorts/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="block truncate font-semibold text-slate-900">{r.name}</span>
                      {r.pendingRemovals > 0 && (
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                          <BellRing className="mr-1 size-3" aria-hidden />
                          {fmt(t.cohorts.pendingRemovals, { count: r.pendingRemovals })}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="size-3.5" aria-hidden />
                        {r.toolCount} {t.cohorts.colTools}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        {r.memberCount} {t.cohorts.colMembers}
                      </span>
                      <span>
                        {t.cohorts.colActiveUntil}:{" "}
                        {r.activeUntil ? fmtDate(r.activeUntil, locale) : t.cohorts.openEnd}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm font-medium text-violet-600">{t.cohorts.manage}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtDate(d: Date | string, locale: string): string {
  const date = d instanceof Date ? d : new Date(d);
  const intlLocale = locale === "en" ? "en-GB" : "nl-NL";
  return date.toLocaleDateString(intlLocale, { dateStyle: "medium" });
}
