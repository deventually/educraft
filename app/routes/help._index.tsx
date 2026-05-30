import { Link } from "react-router";
import { BookOpen, FileText } from "lucide-react";
import type { Route } from "./+types/help._index";
import { getEnabledTools } from "~/lib/registry";
import { HELP_TOPIC_SLUGS, getTopicTitle } from "~/lib/help/registry";
import { getLocale } from "~/lib/i18n/locale.server";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

export function loader({ request }: Route.LoaderArgs) {
  const lang = getLocale(request);
  return {
    topics: HELP_TOPIC_SLUGS.map((slug) => ({ slug, title: getTopicTitle(slug, lang) })),
    tools: getEnabledTools().map((t) => ({
      id: t.id,
      name: t.name,
      tagline: t.tagline,
    })),
  };
}

export default function HelpIndex({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const { topics, tools } = loaderData;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
        {t.help.heading}
      </h1>
      <p className="mt-2 text-slate-600">{t.help.intro}</p>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">{t.help.topicsSection}</h2>
      <ul className="mt-3 space-y-2">
        {topics.map((tp) => (
          <li key={tp.slug}>
            <Link
              to={`/help/${tp.slug}`}
              className="inline-flex items-center gap-2 text-violet-600 hover:underline"
            >
              <FileText className="size-4" /> {tp.title}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-8 text-lg font-semibold text-slate-900">{t.help.toolsSection}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tl) => (
          <li key={tl.id}>
            <Link
              to={`/help/${tl.id}`}
              className="flex h-full flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <BookOpen className="size-4 text-violet-600" /> {loc(tl.name, locale)}
              </span>
              <span className="text-sm text-slate-600">{loc(tl.tagline, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
