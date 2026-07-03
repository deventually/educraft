import { Link } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Route } from "./+types/help.$id";
import {
  getToolById,
  getToolHelpOverlay,
  getTopic,
  getTopicTitle,
  HELP_TOPIC_SLUGS,
} from "~/lib/help/registry";
import { requireUser } from "~/server/auth.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { HelpContent } from "~/components/HelpContent";
import { Markdown } from "~/components/Markdown";
import { useT, useLocale } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  const lang = getLocale(request);
  const tool = getToolById(params.id);
  if (tool) {
    return { kind: "tool" as const, tool, overlay: getToolHelpOverlay(tool.id, lang) };
  }
  if (HELP_TOPIC_SLUGS.includes(params.id)) {
    return {
      kind: "topic" as const,
      title: getTopicTitle(params.id, lang),
      body: getTopic(params.id, lang) ?? "",
    };
  }
  throw new Response("Not Found", { status: 404 });
}

export default function HelpPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/help"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" /> {t.help.allHelp}
      </Link>

      {loaderData.kind === "tool" ? (
        <>
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-medium tracking-tight text-slate-900">
              {loc(loaderData.tool.name, locale)}
            </h1>
            <Link
              to={`/tools/${loaderData.tool.slug}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline"
            >
              {t.help.openTool} <ArrowRight className="size-4" />
            </Link>
          </header>
          <HelpContent tool={loaderData.tool} overlay={loaderData.overlay} locale={locale} />
        </>
      ) : (
        <article>
          <Markdown>{loaderData.body}</Markdown>
        </article>
      )}
    </div>
  );
}
