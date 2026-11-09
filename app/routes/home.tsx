import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, LayoutList, Search, SearchX, X } from "lucide-react";
import type { Route } from "./+types/home";
import { getAvailableTools, isFeatureOn } from "~/server/availability.server";
import { requireUser } from "~/server/auth.server";
import type { InteractionMode, UserType } from "~/lib/registry/types";
import { GOAL_ORDER, GOALS, TOOL_GOALS, type TeachingGoal } from "~/lib/registry/goals";
import { searchTools, toolSearchText } from "~/lib/registry/search";
import { ToolIcon } from "~/components/ToolIcon";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { ToolSubtitle } from "~/components/ToolTitle";
import { UTILITIES, utilitySearchText } from "~/lib/utilities";
import { UtilityCard } from "~/components/utilities/UtilityCard";

// Utilities are static data (no AI, always on), so the search haystack is built once.
const UTILITY_SEARCH = UTILITIES.map((u) => ({ utility: u, search: utilitySearchText(u) }));

interface ToolCardData {
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  /** Book/technique name, small under the name. */
  subtitle?: LocalizedText;
  icon?: string;
  userType: UserType;
  mode: InteractionMode;
  theory: LocalizedText;
  goal: TeachingGoal;
  /** Pre-joined, lower-cased haystack for search (`toolSearchText`, shared with Start). */
  search: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  // Server-side gate (Phase 4): effective availability composes instance settings
  // (enabled) and any per-teacher allow-list — a disabled tool vanishes for
  // everyone.
  const tools: ToolCardData[] = (await getAvailableTools(user)).map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    tagline: tool.tagline,
    subtitle: tool.subtitle,
    icon: tool.icon,
    userType: tool.userType,
    mode: tool.mode,
    theory: tool.theory.name,
    goal: TOOL_GOALS[tool.slug] ?? "design",
    search: toolSearchText(tool),
  }));
  // Utilities can be switched off per team (P28.3): then no section and no search hits.
  return { tools, utilities: await isFeatureOn(user, "utilities") };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { tools, utilities } = loaderData;

  const [query, setQuery] = useState("");

  const resetToGoals = () => setQuery("");

  const isFiltered = query.trim() !== "";

  const results = useMemo(() => searchTools(tools, query), [tools, query]);

  const utilityResults = useMemo(() => {
    if (!utilities) return [];
    return searchTools(UTILITY_SEARCH, query).map((u) => u.utility);
  }, [query, utilities]);

  const resultTotal = results.length + utilityResults.length;

  const resultLabel = (n: number) =>
    fmt(n === 1 ? t.home.resultCountOne : t.home.resultCount, { count: n });

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
          {t.home.heading}
        </h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-slate-600">{t.home.intro}</p>
        <p className="mt-2 text-sm">
          <Link to="/projects" className="font-medium text-violet-700 hover:underline">
            {t.nav.projects}
          </Link>
        </p>
      </div>

      {/* Toolbar: search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={t.home.search}
          label={t.home.a11y.search}
          clearLabel={t.home.a11y.clearSearch}
        />
      </div>

      {/* Live region: announces result-count changes to screen readers. */}
      <p className="mb-6 text-sm text-slate-500" aria-live="polite">
        {isFiltered ? resultLabel(resultTotal) : ""}
      </p>

      {!isFiltered ? (
        <>
          <GoalSections tools={tools} locale={locale} t={t} />
          {utilities && <UtilitiesSection t={t} />}
        </>
      ) : resultTotal === 0 ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/50 px-6 py-14 text-center text-slate-500"
        >
          <SearchX className="size-7" aria-hidden />
          <p className="text-sm">{t.home.noResults}</p>
          <button
            type="button"
            onClick={resetToGoals}
            className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
          >
            {t.home.clear}
          </button>
        </div>
      ) : (
        <section aria-label={t.home.a11y.resultsRegion}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetToGoals}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
            >
              <LayoutList className="size-4 text-violet-500" aria-hidden />
              {t.home.backToGoals}
            </button>
          </div>
          <ToolGrid>
            {results.map((tool) => (
              <li key={tool.slug} className="contents">
                <ToolCard tool={tool} locale={locale} t={t} />
              </li>
            ))}
            {utilityResults.map((u) => (
              <li key={u.id}>
                <UtilityCard utility={u} />
              </li>
            ))}
          </ToolGrid>
        </section>
      )}
    </div>
  );
}

type T = ReturnType<typeof useT>;
type Locale = ReturnType<typeof useLocale>;

/** Default view: tools grouped by teaching goal. */
function GoalSections({ tools, locale, t }: { tools: ToolCardData[]; locale: Locale; t: T }) {
  return (
    <section className="flex flex-col gap-12" aria-label={t.home.a11y.goalRegion}>
      {GOAL_ORDER.map((g) => {
        const goal = GOALS[g];
        const inGoal = tools.filter((tool) => tool.goal === g);
        if (inGoal.length === 0) return null;
        return (
          <section key={g} aria-labelledby={`goal-${g}`}>
            <div className="mb-5 flex items-start gap-3.5">
              <span className="grid size-[46px] shrink-0 place-items-center rounded-[13px] bg-violet-50 text-violet-600">
                <ToolIcon name={goal.icon} className="size-[22px]" />
              </span>
              <div className="min-w-0 flex-1">
                <h2
                  id={`goal-${g}`}
                  className="flex flex-wrap items-center gap-2.5 font-display text-xl font-medium tracking-tight text-slate-900"
                >
                  {loc(goal.name, locale)}
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-sans text-xs font-semibold text-slate-500">
                    {inGoal.length}
                  </span>
                </h2>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
                  {loc(goal.blurb, locale)}
                </p>
              </div>
            </div>
            <ToolGrid>
              {inGoal.map((tool) => (
                <li key={tool.slug} className="contents">
                  <ToolCard tool={tool} locale={locale} t={t} />
                </li>
              ))}
            </ToolGrid>
          </section>
        );
      })}
    </section>
  );
}

/** Utilities without AI (P23), below the tools: a card each and a link to /utilities. */
function UtilitiesSection({ t }: { t: T }) {
  return (
    <section aria-labelledby="utilities-heading" className="mt-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="utilities-heading"
            className="font-display text-xl font-medium tracking-tight text-slate-900"
          >
            {t.utilities.heading}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {t.utilities.sectionIntro}
          </p>
        </div>
        <Link
          to="/utilities"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-700 hover:underline"
        >
          {t.utilities.allLink}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ToolGrid>
        {UTILITIES.map((u) => (
          <li key={u.id}>
            <UtilityCard utility={u} />
          </li>
        ))}
      </ToolGrid>
    </section>
  );
}

/** Container-responsive grid (column count follows available width). */
function ToolGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid list-none gap-5 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
      {children}
    </ul>
  );
}

function toolAria(tool: ToolCardData, locale: Locale, t: T) {
  const kind = tool.mode === "chat" ? t.home.a11y.chatbot : t.home.a11y.generator;
  return `${t.home.a11y.open}: ${loc(tool.name, locale)}. ${kind}. ${loc(tool.tagline, locale)}`;
}

function ToolCard({ tool, locale, t }: { tool: ToolCardData; locale: Locale; t: T }) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      aria-label={toolAria(tool, locale, t)}
      className="group row-span-3 grid grid-rows-subgrid items-start gap-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <ToolIcon name={tool.icon} />
        </span>
        <div className="min-w-0 flex-1 self-center">
          <h3 className="m-0 text-base font-semibold leading-snug text-slate-900">
            {loc(tool.name, locale)}
          </h3>
          <ToolSubtitle subtitle={tool.subtitle} locale={locale} className="mt-0.5" />
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{loc(tool.tagline, locale)}</p>
      <div className="flex items-center justify-end self-end">
        <ArrowRight className="size-4 shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ── Small primitives ────────────────────────────────────────────────────────

function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  clearLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  clearLabel: string;
}) {
  return (
    <search className="flex h-11 min-w-[280px] max-w-[460px] flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-white px-3 shadow-sm transition-colors focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/30">
      <label htmlFor="ec-tool-search" className="sr-only">
        {label}
      </label>
      <Search className="size-[18px] shrink-0 text-slate-400" aria-hidden />
      <input
        id="ec-tool-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </search>
  );
}
