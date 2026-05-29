import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import type { Route } from "./+types/home";
import { getEnabledTools } from "~/lib/registry";
import type { UserType } from "~/lib/registry/types";
import { ToolIcon } from "~/components/ToolIcon";
import { Badge } from "~/components/ui";
import { cn } from "~/lib/utils";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

export function loader() {
  const tools = getEnabledTools().map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    tagline: tool.tagline,
    icon: tool.icon,
    userType: tool.userType,
    mode: tool.mode,
    theory: tool.theory.name,
  }));
  return { tools };
}

type Filter = "all" | UserType;

export default function Home({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { tools } = loaderData;
  const [filter, setFilter] = useState<Filter>("all");
  const shown = tools.filter((tl) => filter === "all" || tl.userType === filter);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t.home.heading}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{t.home.intro}</p>
      </div>

      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(
          [
            ["all", t.home.filterAll],
            ["instructor", t.home.instructor],
            ["student", t.home.student],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              filter === value
                ? "bg-violet-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((tool) => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <ToolIcon name={tool.icon} />
              </span>
              <Badge>{tool.userType === "instructor" ? t.badge.instructor : t.badge.student}</Badge>
            </div>
            <h2 className="font-semibold text-slate-900">{loc(tool.name, locale)}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{loc(tool.tagline, locale)}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">{loc(tool.theory, locale)}</span>
              <ArrowRight className="size-4 text-violet-500 transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
