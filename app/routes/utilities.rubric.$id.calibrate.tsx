import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.$id.calibrate";
import { requireFeatureUser } from "~/server/features.server";
import { getRubric } from "~/server/repositories/rubrics.server";
import { getSharedRubric } from "~/server/repositories/shares.server";
import { RubricCalibrate } from "~/components/utilities/RubricCalibrate";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

/**
 * Calibrating with a second rater (P34.2): an own rubric, or one shared with your team (read
 * only, P28.4). No action: the scores stay in the browser and nothing is written.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireFeatureUser(request, "utilities");
  const own = await getRubric(user.id, params.id);
  const rubric = own ?? (await getSharedRubric(user.id, params.id));
  if (!rubric) throw new Response("Not Found", { status: 404 });
  return { rubric: { id: rubric.id, name: rubric.name, data: rubric.data }, shared: !own };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function RubricCalibratePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const s = t.rubricCalibrate;
  const { rubric, shared } = loaderData;
  return (
    <div>
      <Link
        to={shared ? `/utilities/rubric/shared/${rubric.id}` : `/utilities/rubric/${rubric.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {s.back}
      </Link>
      <h1 className="mb-4 mt-4 font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
        {fmt(s.heading, { name: rubric.name })}
      </h1>
      {shared && <p className="mb-3 max-w-[70ch] text-sm text-slate-600">{s.shared}</p>}
      <RubricCalibrate key={rubric.id} rubric={rubric} />
    </div>
  );
}
