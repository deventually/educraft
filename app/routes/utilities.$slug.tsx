import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/utilities.$slug";
import { requireUser } from "~/server/auth.server";
import { getUtilityBySlug, type Utility } from "~/lib/utilities";
import { GradeCalculator } from "~/components/utilities/GradeCalculator";
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
  await requireUser(request);
  return { slug: resolveUtility(params.slug).slug };
}

export function meta({ data, matches }: Route.MetaArgs) {
  const root = matches.find((m) => m?.id === "root")?.data as { locale?: Locale } | undefined;
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
function UtilityView({ slug }: { slug: string }) {
  switch (slug) {
    case "grade-calculator":
      return <GradeCalculator />;
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
      <UtilityView slug={utility.slug} />
    </div>
  );
}
