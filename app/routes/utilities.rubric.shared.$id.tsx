import { Form, Link, redirect } from "react-router";
import { ArrowLeft, CopyPlus, Scale } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.shared.$id";
import { requireFeatureUser } from "~/server/features.server";
import { copySharedItem, getSharedRubric } from "~/server/repositories/shares.server";
import { Button } from "~/components/ui";
import { formatNumber } from "~/components/utilities/format";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

/**
 * A colleague's rubric, shared with your team (P28.4): read only, with "Maak een kopie".
 * Not shared with you (or not any more) is a 404. Filled-in scores are never shared.
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireFeatureUser(request, "utilities");
  const rubric = await getSharedRubric(user.id, params.id);
  if (!rubric) throw new Response("Not Found", { status: 404 });
  return { rubric };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireFeatureUser(request, "utilities");
  const fd = await request.formData();
  if (fd.get("intent") !== "copy") return { error: "invalid" as const };
  const copyId = await copySharedItem(user.id, "rubric", params.id);
  return redirect(copyId ? `/utilities/rubric/${copyId}` : "/utilities/rubric");
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function SharedRubricPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const s = t.sharing;
  const r = t.utilities.rubric;
  const locale = useLocale();
  const { rubric } = loaderData;
  return (
    <div>
      <Link
        to="/utilities/rubric"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {r.back}
      </Link>
      <h1 className="mt-4 font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
        {rubric.name}
      </h1>
      <p className="mt-2 max-w-[65ch] text-slate-600">
        {fmt(s.readOnly, { owner: rubric.ownerName })}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Form method="post">
          <input type="hidden" name="intent" value="copy" />
          <Button type="submit" size="sm">
            <CopyPlus className="size-4" aria-hidden />
            {s.copy}
          </Button>
        </Form>
        <Link
          to={`/utilities/rubric/${rubric.id}/calibrate`}
          className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        >
          <Scale className="size-4" aria-hidden />
          {t.rubricCalibrate.link}
        </Link>
      </div>
      <div className="mt-6 space-y-6">
        {rubric.data.criteria.map((criterion) => (
          <section
            key={criterion.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">{criterion.title}</h2>
            <ul className="mt-2 space-y-2">
              {criterion.levels.map((level) => (
                <li key={level.id} className="text-sm text-slate-700">
                  <span className="font-medium text-slate-900">
                    {level.label} · {formatNumber(level.points, locale)}
                  </span>
                  {level.description && <span className="block">{level.description}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
