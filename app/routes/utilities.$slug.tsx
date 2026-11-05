import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/utilities.$slug";
import { requireUser } from "~/server/auth.server";
import { getUtilityBySlug, type Utility } from "~/lib/utilities";
import { GradeCalculator } from "~/components/utilities/GradeCalculator";
import { ItemAnalysis } from "~/components/utilities/ItemAnalysis";
import { getToolBySlug } from "~/lib/registry";
import { isToolAvailable } from "~/server/availability.server";
import { useLocale, useT } from "~/lib/i18n/useT";
import { loc } from "~/lib/i18n/localized";
import { DEFAULT_LOCALE, type Locale } from "~/lib/i18n";

/** The utility for a slug, or a 404 Response. */
export function resolveUtility(slug: string | undefined): Utility {
  const utility = slug ? getUtilityBySlug(slug) : undefined;
  if (!utility) throw new Response("Not Found", { status: 404 });
  return utility;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const utility = resolveUtility(params.slug);
  // The explaining AI tool is offered only when this teacher may use it (enforced server-side
  // again by the tool loader and /api/stream).
  const tool = utility.explainWith ? getToolBySlug(utility.explainWith) : undefined;
  const explainWith = tool && (await isToolAvailable(user, tool)) ? tool.slug : null;
  return { slug: utility.slug, explainWith };
}

export function meta({ loaderData: data, matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.loaderData as { locale?: Locale } | undefined;
  const utility = data ? getUtilityBySlug(data.slug) : undefined;
  return [
    {
      title: utility
        ? `${loc(utility.name, root?.locale ?? DEFAULT_LOCALE)} — LimeOnIt`
        : "LimeOnIt",
    },
  ];
}

/**
 * One utility page. A single switch on slug picks the component: there is no shared engine to
 * refactor towards, and two to four utilities do not justify a generic form layer (P23).
 */
function UtilityView({ slug, explainWith }: { slug: string; explainWith: string | null }) {
  switch (slug) {
    case "grade-calculator":
      return <GradeCalculator />;
    case "item-analysis":
      return <ItemAnalysis explainWith={explainWith ?? undefined} />;
    default:
      return null;
  }
}

export default function UtilityPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const locale = useLocale();
  const utility = resolveUtility(loaderData.slug);
  return (
    <div>
      <Link
        to="/utilities"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.utilities.back}
      </Link>
      <div className="mb-8 mt-4">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
          {loc(utility.name, locale)}
        </h1>
        <p className="mt-3 max-w-[60ch] text-pretty text-slate-600 print:hidden">
          {loc(utility.summary, locale)}
        </p>
      </div>
      <UtilityView slug={utility.slug} explainWith={loaderData.explainWith ?? null} />
    </div>
  );
}
