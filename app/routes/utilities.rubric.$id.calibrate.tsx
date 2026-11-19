import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.$id.calibrate";
import { requireFeatureUser } from "~/server/features.server";
import { getRubric } from "~/server/repositories/rubrics.server";
import { getSharedRubric } from "~/server/repositories/shares.server";
import { dossierTargets } from "~/server/courseEvidence.server";
import { addCalibrationEvidence, calibrationDate } from "~/server/calibrationEvidence.server";
import { getLocale } from "~/lib/i18n/locale.server";
import { useActionToast } from "~/components/Toast";
import { RubricCalibrate } from "~/components/utilities/RubricCalibrate";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

/** An own rubric, or one shared with your team (read only, P28.4); anything else is a 404. */
async function loadRubric(request: Request, id: string) {
  const user = await requireFeatureUser(request, "utilities");
  const own = await getRubric(user.id, id);
  const rubric = own ?? (await getSharedRubric(user.id, id));
  if (!rubric) throw new Response("Not Found", { status: 404 });
  return { user, rubric, shared: !own };
}

/**
 * Calibrating with a second rater (P34.2). The scores stay in the browser and the rubric is
 * never written; the dossiers and today's date are there for "Gebruik als bewijs" (P34.3).
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, rubric, shared } = await loadRubric(request, params.id);
  return {
    rubric: { id: rubric.id, name: rubric.name, data: rubric.data },
    shared,
    dossiers: await dossierTargets(user),
    today: await calibrationDate(),
  };
}

/** "Gebruik als bewijs" (P34.3): only the summary, never a code, goes to an own dossier. */
export async function action({ request, params }: Route.ActionArgs) {
  const { user, rubric } = await loadRubric(request, params.id);
  const fd = await request.formData();
  if (fd.get("intent") !== "use-as-evidence") throw new Response("Bad Request", { status: 400 });
  return addCalibrationEvidence(user, rubric, fd, getLocale(request));
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function RubricCalibratePage({ loaderData, actionData }: Route.ComponentProps) {
  const t = useT();
  const s = t.rubricCalibrate;
  const { rubric, shared, dossiers, today } = loaderData;
  useActionToast(actionData, (r) =>
    r.ok
      ? { variant: "success", message: s.evidence.done }
      : { variant: "error", message: r.error },
  );
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
      <RubricCalibrate key={rubric.id} rubric={rubric} dossiers={dossiers} today={today} />
    </div>
  );
}
