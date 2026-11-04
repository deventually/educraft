import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.$id.fill";
import { requireUser } from "~/server/auth.server";
import { getRubric } from "~/server/repositories/rubrics.server";
import { addRubricScores } from "~/server/repositories/rubricScores.server";
import { RubricFill } from "~/components/utilities/RubricFill";
import { useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const rubric = await getRubric(user.id, params.id);
  if (!rubric) throw new Response("Not Found", { status: 404 });
  return { rubric: { id: rubric.id, name: rubric.name, data: rubric.data } };
}

/** 200 fill-ins of 30 pairs of two UUIDs stay well under this. */
const MAX_JSON = 600_000;

/**
 * "Batch afsluiten" (P23.3): the only thing the browser ever posts here. It carries anonymous
 * criterion → level pairs; `addRubricScores` refuses anything else (extra keys, unknown ids).
 */
export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  if (fd.get("intent") !== "closeBatch") return { error: "invalid" as const };
  const raw = String(fd.get("scoresJson") ?? "");
  try {
    if (raw.length > MAX_JSON) throw new Error("too large");
    const closed = await addRubricScores(user.id, params.id, JSON.parse(raw));
    if (closed === null) return { error: "notFound" as const };
    return { closed };
  } catch {
    return { error: "invalid" as const };
  }
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function RubricFillPage({ loaderData, actionData }: Route.ComponentProps) {
  const t = useT();
  const f = t.utilities.rubric.fill;
  const { rubric } = loaderData;
  return (
    <div>
      <Link
        to={`/utilities/rubric/${rubric.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline print:hidden"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {f.back}
      </Link>
      <h1 className="mb-6 mt-4 font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
        {fmt(f.heading, { name: rubric.name })}
      </h1>
      <RubricFill key={rubric.id} rubric={rubric} result={actionData} />
    </div>
  );
}
