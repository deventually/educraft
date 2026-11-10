import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookOpen, FileText, Search } from "lucide-react";
import type { Route } from "./+types/help._index";
import { helpSections } from "~/lib/help/sections";
import { searchHelp } from "~/lib/help/search";
import { GOAL_ORDER, GOALS, TOOL_GOALS } from "~/lib/registry/goals";
import { toolSearchText } from "~/lib/registry/search";
import { getAvailableTools } from "~/server/availability.server";
import { requireUser } from "~/server/auth.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const lang = getLocale(request);
  // The same tools as the catalogue: only what this teacher can open.
  const tools = (await getAvailableTools(user)).filter((tool) => !tool.hiddenFromCatalogue);
  return {
    sections: helpSections(lang, { isAdmin: user.role === "admin" }),
    toolGroups: GOAL_ORDER.map((goal) => ({
      goal,
      name: GOALS[goal].name,
      tools: tools
        .filter((tool) => (TOOL_GOALS[tool.slug] ?? "design") === goal)
        .map((tool) => ({
          id: tool.id,
          name: tool.name,
          tagline: tool.tagline,
          search: toolSearchText(tool),
        })),
    })).filter((g) => g.tools.length > 0),
  };
}

const h2 = "text-lg font-semibold text-slate-900";

export default function HelpIndex({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { sections, toolGroups } = loaderData;
  const [query, setQuery] = useState("");

  const items = useMemo(
    () => [
      ...sections.flatMap((s) =>
        s.topics.map((tp) => ({
          href: `/help/${tp.slug}`,
          title: tp.title,
          search: tp.search,
          headings: tp.headings,
        })),
      ),
      ...toolGroups.flatMap((g) =>
        g.tools.map((tl) => ({
          href: `/help/${tl.id}`,
          title: loc(tl.name, locale),
          search: tl.search,
          headings: [],
        })),
      ),
    ],
    [sections, toolGroups, locale],
  );
  const hits = useMemo(() => searchHelp(items, query), [items, query]);
  const searching = query.trim() !== "";

  return (
    <div className="w-full min-w-0">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.help.heading}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">{t.help.intro}</p>

      <div className="relative mt-6 max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
        <input
          type="search"
          aria-label={t.help.search}
          placeholder={t.help.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus-visible:border-violet-400 focus-visible:outline-2 focus-visible:outline-violet-500"
        />
      </div>
      <p className="mt-2 text-sm text-slate-500" aria-live="polite">
        {searching
          ? hits.length === 0
            ? t.help.noResults
            : hits.length === 1
              ? t.help.resultCountOne
              : fmt(t.help.resultCount, { count: hits.length })
          : ""}
      </p>

      {searching ? (
        <section aria-label={t.help.resultsRegion} className="mt-4">
          <ul className="space-y-3">
            {hits.map((hit) => (
              <li key={hit.href}>
                <Link
                  to={hit.href}
                  className="inline-flex items-center gap-2 font-medium text-violet-700 hover:underline"
                >
                  <FileText className="size-4" aria-hidden />
                  {hit.title}
                </Link>
                {hit.headings.length > 0 && (
                  <ul className="mt-1 ml-6 space-y-1 text-sm">
                    {hit.headings.map((h) => (
                      <li key={h.anchor}>
                        <Link
                          to={`${hit.href}#${h.anchor}`}
                          className="text-slate-600 underline-offset-2 hover:text-violet-700 hover:underline"
                        >
                          {h.text}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
            {sections.map((s) => (
              <section key={s.id} aria-labelledby={`help-${s.id}`}>
                <h2 id={`help-${s.id}`} className={h2}>
                  {s.title}
                </h2>
                <ul className="mt-3 space-y-2">
                  {s.topics.map((tp) => (
                    <li key={tp.slug}>
                      <Link
                        to={`/help/${tp.slug}`}
                        className="inline-flex items-center gap-2 text-violet-700 hover:underline"
                      >
                        <FileText className="size-4" aria-hidden /> {tp.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <h2 className={`mt-12 ${h2}`}>{t.help.toolsSection}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.help.toolsIntro}</p>
          {toolGroups.map((g) => (
            <section key={g.goal} aria-labelledby={`help-goal-${g.goal}`} className="mt-6">
              <h3 id={`help-goal-${g.goal}`} className="font-medium text-slate-800">
                {loc(g.name, locale)}
              </h3>
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {g.tools.map((tl) => (
                  <li key={tl.id}>
                    <Link
                      to={`/help/${tl.id}`}
                      className="flex h-full flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
                    >
                      <span className="flex items-center gap-2 font-medium text-slate-900">
                        <BookOpen className="size-4 text-violet-600" aria-hidden />{" "}
                        {loc(tl.name, locale)}
                      </span>
                      <span className="text-sm text-slate-600">{loc(tl.tagline, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
