import { Form, Link, redirect } from "react-router";
import { ArrowLeft, ClipboardCheck, CopyPlus, Trash2 } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.$id";
import { requireUser } from "~/server/auth.server";
import {
  deleteRubric,
  duplicateRubric,
  getRubric,
  updateRubric,
} from "~/server/repositories/rubrics.server";
import { listRubricScores } from "~/server/repositories/rubricScores.server";
import { RubricInsight } from "~/components/utilities/RubricInsight";
import { RubricEditor } from "~/components/utilities/RubricEditor";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Button } from "~/components/ui";
import { getLocale } from "~/lib/i18n/locale.server";
import { getMessages } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";
import { levelDistribution, RUBRIC_LIMITS } from "~/lib/utilities/rubric";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const rubric = await getRubric(user.id, params.id);
  if (!rubric) throw new Response("Not Found", { status: 404 });
  const scores = await listRubricScores(user.id, rubric.id);
  return {
    rubric: { id: rubric.id, name: rubric.name, data: rubric.data },
    scoreCount: scores.length,
    // Null under five closed fill-ins, so one student is not recognisable (P23.3).
    insight: levelDistribution(
      rubric.data,
      scores.map((s) => s.levels),
    ),
  };
}

const MAX_JSON = 200_000;

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireUser(request);
  const fd = await request.formData();
  const intent = fd.get("intent");
  const existing = await getRubric(user.id, params.id);
  if (!existing) return { error: "notFound" as const };

  if (intent === "save") {
    const raw = String(fd.get("dataJson") ?? "");
    try {
      if (raw.length > MAX_JSON) throw new Error("too large");
      // updateRubric re-parses with RubricDataSchema and the name rule; invalid → nothing written.
      await updateRubric(user.id, existing.id, {
        name: String(fd.get("name") ?? ""),
        data: JSON.parse(raw),
      });
      return { ok: true as const };
    } catch {
      return { error: "invalid" as const };
    }
  }
  if (intent === "duplicate") {
    const suffix = getMessages(getLocale(request)).utilities.rubric.copySuffix;
    const name = `${existing.name} ${suffix}`.slice(0, RUBRIC_LIMITS.name);
    const copy = await duplicateRubric(user.id, existing.id, name);
    return redirect(copy ? `/utilities/rubric/${copy.id}` : "/utilities/rubric");
  }
  if (intent === "delete") {
    await deleteRubric(user.id, existing.id);
    return redirect("/utilities/rubric");
  }
  return { error: "invalid" as const };
}

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function RubricPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const r = t.utilities.rubric;
  const { rubric, insight, scoreCount } = loaderData;
  return (
    <div>
      <Link
        to="/utilities/rubric"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {r.back}
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-[clamp(1.7rem,4vw,2.05rem)] font-medium tracking-tight text-balance text-slate-900">
          {rubric.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/utilities/rubric/${rubric.id}/fill`}
            className="inline-flex h-8 items-center gap-2 rounded-lg bg-violet-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <ClipboardCheck className="size-4" aria-hidden />
            {r.fill.link}
          </Link>
          <Form method="post">
            <input type="hidden" name="intent" value="duplicate" />
            <Button type="submit" variant="secondary" size="sm">
              <CopyPlus className="size-4" aria-hidden />
              {r.duplicate}
            </Button>
          </Form>
          <ConfirmDialog
            triggerLabel={r.delete}
            triggerIcon={<Trash2 className="size-4" aria-hidden />}
            title={r.deleteTitle}
            description={r.deleteBody}
            confirmLabel={r.delete}
            cancelLabel={t.confirm.cancel}
            fields={{ intent: "delete" }}
          />
        </div>
      </div>
      {/* Keyed on id: a duplicate opens with fresh editor state. */}
      <RubricEditor key={rubric.id} rubric={rubric} />
      <RubricInsight insight={insight} count={scoreCount} />
    </div>
  );
}
