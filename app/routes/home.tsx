import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  LayoutGrid,
  LayoutList,
  List,
  MessagesSquare,
  Search,
  SearchX,
  Sparkles,
  X,
} from "lucide-react";
import type { Route } from "./+types/home";
import { getEnabledTools } from "~/lib/registry";
import type { InteractionMode, UserType } from "~/lib/registry/types";
import {
  GOAL_ORDER,
  GOALS,
  TOOL_GOALS,
  TOOL_KEYWORDS,
  type TeachingGoal,
} from "~/lib/registry/goals";
import { ToolIcon } from "~/components/ToolIcon";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";

interface ToolCardData {
  slug: string;
  name: LocalizedText;
  tagline: LocalizedText;
  icon?: string;
  userType: UserType;
  mode: InteractionMode;
  theory: LocalizedText;
  goal: TeachingGoal;
  /** Pre-joined, lower-cased haystack for search (name + tagline + theory + keywords, both locales). */
  search: string;
  /** > 1 for the multi-stage tools (drives the "N fasen" chip). */
  stages: number;
}

export function loader() {
  const tools: ToolCardData[] = getEnabledTools().map((tool) => {
    const keywords = TOOL_KEYWORDS[tool.slug] ?? [];
    const text = (v: LocalizedText) => [loc(v, "nl"), loc(v, "en")].join(" ");
    return {
      slug: tool.slug,
      name: tool.name,
      tagline: tool.tagline,
      icon: tool.icon,
      userType: tool.userType,
      mode: tool.mode,
      theory: tool.theory.name,
      goal: TOOL_GOALS[tool.slug] ?? "design",
      search: [text(tool.name), text(tool.tagline), text(tool.theory.name), keywords.join(" ")]
        .join(" ")
        .toLowerCase(),
      stages: tool.stages.length,
    };
  });
  return { tools };
}

type AudienceFilter = "all" | UserType;
type TypeFilter = "all" | "gen" | "chat";
type ResultView = "grid" | "list";

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { tools } = loaderData;

  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  // Remembered result view (grid/list). Read from localStorage after mount to
  // stay SSR-safe; default to "grid".
  const [resultView, setResultView] = useState<ResultView>("grid");
  useEffect(() => {
    const saved = localStorage.getItem("ec-result-view");
    if (saved === "grid" || saved === "list") setResultView(saved);
  }, []);
  const chooseView = (view: ResultView) => {
    setResultView(view);
    localStorage.setItem("ec-result-view", view);
  };

  const resetToGoals = () => {
    setQuery("");
    setAudience("all");
    setType("all");
  };

  const counts = useMemo(
    () => ({
      all: tools.length,
      instructor: tools.filter((x) => x.userType === "instructor").length,
      student: tools.filter((x) => x.userType === "student").length,
    }),
    [tools],
  );

  const isFiltered = query.trim() !== "" || audience !== "all" || type !== "all";

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tools.filter((tool) => {
      if (audience !== "all" && tool.userType !== audience) return false;
      if (type === "gen" && tool.mode !== "one-shot") return false;
      if (type === "chat" && tool.mode !== "chat") return false;
      if (q && !tool.search.includes(q)) return false;
      return true;
    });
  }, [tools, query, audience, type]);

  const resultLabel = (n: number) =>
    fmt(n === 1 ? t.home.resultCountOne : t.home.resultCount, { count: n });

  return (
    <div>
      <div className="mb-7">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
          {t.home.heading}
        </h1>
        <p className="mt-2 max-w-[60ch] text-pretty text-slate-600">{t.home.intro}</p>
      </div>

      {/* Toolbar: search + audience + type filters */}
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder={t.home.search}
          label={t.home.a11y.search}
          clearLabel={t.home.a11y.clearSearch}
        />
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap">
          <Segmented
            ariaLabel={t.home.a11y.audience}
            value={audience}
            onChange={setAudience}
            options={[
              { value: "all", label: t.home.filterAll, count: counts.all },
              { value: "instructor", label: t.home.instructor, count: counts.instructor },
              { value: "student", label: t.home.student, count: counts.student },
            ]}
          />
          <Segmented
            ariaLabel={t.home.a11y.type}
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: t.home.allTypes },
              { value: "gen", label: t.home.generators },
              { value: "chat", label: t.home.chatbots },
            ]}
          />
        </div>
      </div>

      {/* Live region: announces result-count changes to screen readers. */}
      <p className="mb-4 text-sm text-slate-500" aria-live="polite">
        {isFiltered ? resultLabel(results.length) : ""}
      </p>

      {!isFiltered ? (
        <GoalSections tools={tools} locale={locale} t={t} />
      ) : results.length === 0 ? (
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
            <fieldset
              aria-label={t.home.a11y.resultView}
              className="m-0 inline-flex min-w-0 rounded-[10px] border border-slate-200 bg-white p-[3px] shadow-sm"
            >
              <ViewButton
                active={resultView === "grid"}
                onClick={() => chooseView("grid")}
                label={t.home.a11y.grid}
                icon={<LayoutGrid className="size-4" aria-hidden />}
              />
              <ViewButton
                active={resultView === "list"}
                onClick={() => chooseView("list")}
                label={t.home.a11y.list}
                icon={<List className="size-4" aria-hidden />}
              />
            </fieldset>
          </div>
          {resultView === "grid" ? (
            <ToolGrid>
              {results.map((tool) => (
                <li key={tool.slug} className="flex">
                  <ToolCard tool={tool} locale={locale} t={t} />
                </li>
              ))}
            </ToolGrid>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {results.map((tool) => (
                <li key={tool.slug}>
                  <ToolRow tool={tool} locale={locale} t={t} showAudience />
                </li>
              ))}
            </ul>
          )}
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
    <section className="flex flex-col gap-9" aria-label={t.home.a11y.goalRegion}>
      {GOAL_ORDER.map((g) => {
        const goal = GOALS[g];
        const inGoal = tools.filter((tool) => tool.goal === g);
        if (inGoal.length === 0) return null;
        const isStudent = goal.audience === "student";
        return (
          <section key={g} aria-labelledby={`goal-${g}`}>
            <div className="mb-4 flex items-start gap-3.5">
              <span
                className={cn(
                  "grid size-[46px] shrink-0 place-items-center rounded-[13px]",
                  isStudent ? "bg-amber-50 text-brass-600" : "bg-violet-50 text-violet-600",
                )}
              >
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
              <Badge tone={isStudent ? "brass" : "slate"}>
                {isStudent ? t.badge.student : t.badge.instructor}
              </Badge>
            </div>
            <ToolGrid>
              {inGoal.map((tool) => (
                <li key={tool.slug} className="flex">
                  <ToolCard tool={tool} locale={locale} t={t} showAudience={false} />
                </li>
              ))}
            </ToolGrid>
          </section>
        );
      })}
    </section>
  );
}

/** Container-responsive grid (column count follows available width). */
function ToolGrid({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid list-none gap-4 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr))]">
      {children}
    </ul>
  );
}

function toolAria(tool: ToolCardData, locale: Locale, t: T) {
  const aud = tool.userType === "instructor" ? t.badge.instructor : t.badge.student;
  const kind = tool.mode === "chat" ? t.home.a11y.chatbot : t.home.a11y.generator;
  return `${t.home.a11y.open}: ${loc(tool.name, locale)}. ${aud}, ${kind}. ${loc(tool.tagline, locale)}`;
}

function ToolCard({
  tool,
  locale,
  t,
  showAudience = true,
}: {
  tool: ToolCardData;
  locale: Locale;
  t: T;
  showAudience?: boolean;
}) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      aria-label={toolAria(tool, locale, t)}
      className="group flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
          <ToolIcon name={tool.icon} />
        </span>
        <h3 className="m-0 flex min-w-0 flex-1 flex-wrap items-center gap-2 text-base font-semibold leading-snug text-slate-900">
          {loc(tool.name, locale)}
          {tool.stages > 1 && <StageChip count={tool.stages} t={t} />}
        </h3>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {showAudience && (
          <Badge tone={tool.userType === "student" ? "brass" : "slate"}>
            {tool.userType === "student" ? t.badge.student : t.badge.instructor}
          </Badge>
        )}
        <ModePill mode={tool.mode} t={t} />
      </div>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">
        {loc(tool.tagline, locale)}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <BookOpen className="size-3.5 text-slate-400" aria-hidden />
          {loc(tool.theory, locale)}
        </span>
        <ArrowRight className="size-4 shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

function ToolRow({
  tool,
  locale,
  t,
  showAudience,
}: {
  tool: ToolCardData;
  locale: Locale;
  t: T;
  showAudience?: boolean;
}) {
  const isStudent = tool.userType === "student";
  return (
    <Link
      to={`/tools/${tool.slug}`}
      aria-label={toolAria(tool, locale, t)}
      className={cn(
        "group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition-all hover:-translate-y-px hover:shadow-md",
        isStudent ? "hover:border-[#e3c98f]" : "hover:border-violet-200",
      )}
    >
      <span
        className={cn(
          "grid size-[38px] shrink-0 place-items-center rounded-[10px]",
          isStudent ? "bg-amber-50 text-brass-600" : "bg-violet-50 text-violet-600",
        )}
      >
        <ToolIcon name={tool.icon} className="size-[18px]" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-slate-900">
          {loc(tool.name, locale)}
          {showAudience && (
            <Badge tone={isStudent ? "brass" : "slate"}>
              {isStudent ? t.badge.student : t.badge.instructor}
            </Badge>
          )}
          <ModePill mode={tool.mode} t={t} />
        </span>
        <span className="truncate text-[13px] leading-snug text-slate-500">
          {loc(tool.tagline, locale)}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-violet-500 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

// ── Small primitives ────────────────────────────────────────────────────────

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "brass";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
        tone === "brass"
          ? "border-[#ecdcc0] bg-amber-50 text-brass-600"
          : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      {children}
    </span>
  );
}

function ModePill({ mode, t }: { mode: InteractionMode; t: T }) {
  const isChat = mode === "chat";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2 text-[11px] font-semibold",
        isChat ? "bg-slate-100 text-slate-600" : "bg-violet-50 text-violet-700",
      )}
    >
      {isChat ? (
        <MessagesSquare className="size-3" aria-hidden />
      ) : (
        <Sparkles className="size-3" aria-hidden />
      )}
      {isChat ? t.home.mode.chatbot : t.home.mode.generator}
    </span>
  );
}

function StageChip({ count, t }: { count: number; t: T }) {
  return (
    <span className="whitespace-nowrap rounded-full border border-[#ecdcc0] bg-amber-50 px-1.5 py-px text-[10.5px] font-semibold text-brass-600">
      {fmt(t.home.stages, { count })}
    </span>
  );
}

interface SegOption<V extends string> {
  value: V;
  label: string;
  count?: number;
}

function Segmented<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegOption<V>[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel: string;
}) {
  return (
    <fieldset
      aria-label={ariaLabel}
      className="m-0 flex w-full min-w-0 justify-between rounded-xl border border-slate-200 bg-white p-[3px] shadow-sm sm:inline-flex sm:w-auto sm:justify-start"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1 sm:flex-none sm:justify-start sm:px-3 sm:text-sm",
              active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                )}
                aria-hidden
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-1",
        active ? "bg-violet-600 text-white" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

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
        className="h-full flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
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
