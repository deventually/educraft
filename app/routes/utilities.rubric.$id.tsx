import { Form, Link, redirect, useActionData } from "react-router";
import { ArrowLeft, ClipboardCheck, CopyPlus, Scale, Trash2 } from "lucide-react";
import type { Route } from "./+types/utilities.rubric.$id";
import { requireFeatureUser } from "~/server/features.server";
import {
  deleteRubric,
  duplicateRubric,
  getRubric,
  updateRubric,
} from "~/server/repositories/rubrics.server";
import { listRubricScores } from "~/server/repositories/rubricScores.server";
import { shareAction, shareControls } from "~/server/sharing.server";
import { ShareWithTeam } from "~/components/sharing/ShareWithTeam";
import { RubricGroup } from "~/components/utilities/RubricGroup";
import { RubricEditor } from "~/components/utilities/RubricEditor";
import { ConfirmDialog } from "~/components/ConfirmDialog";
import { Button } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { getLocale } from "~/lib/i18n/locale.server";
import { getMessages } from "~/lib/i18n";
import { useT } from "~/lib/i18n/useT";
import { groupSummary, RUBRIC_LIMITS, rubricRounds } from "~/lib/utilities/rubric";
import { redirectWithFlash } from "~/server/flash.server";
import { getUtilityBySlug } from "~/lib/utilities";
import { getToolBySlug } from "~/lib/registry";
import { isToolAvailable } from "~/server/availability.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireFeatureUser(request, "utilities");
  const rubric = await getRubric(user.id, params.id);
  if (!rubric) throw new Response("Not Found", { status: 404 });
  const scores = await listRubricScores(user.id, rubric.id);
  // P36.1: one round (month) at a time, the newest unless ?round= names another.
  const rounds = rubricRounds(scores);
  const wanted = new URL(request.url).searchParams.get("round");
  const selected = rounds.find((r) => r.month === wanted)?.month ?? rounds[0]?.month ?? "";
  // P36.2: "Groepsfeedback maken" shows only when that tool is available to this teacher.
  const slug = getUtilityBySlug("rubric")?.explainWith;
  const tool = slug ? getToolBySlug(slug) : undefined;
  const feedbackWith = tool && (await isToolAvailable(user, tool)) ? tool.slug : null;
  return {
    rubric: { id: rubric.id, name: rubric.name, data: rubric.data },
    scoreCount: scores.length,
    rounds,
    selected,
    // Null under five closed fill-ins in the round, so one student is not recognisable (P23.3).
    group: groupSummary(rubric.data, scores, selected),
    feedbackWith,
    sharing: await shareControls(user, "rubric", rubric.id),
  };
}

const MAX_JSON = 200_000;

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireFeatureUser(request, "utilities");
  const existing = await getRubric(user.id, params.id);
  if (!existing) return { error: "notFound" as const };
  // "Delen met team" (P28.4): only the owner gets here (getRubric is owner-scoped).
  const shared = await shareAction(request, user, "rubric", existing.id);
  if (shared) return shared;
  const fd = await request.formData();
  const intent = fd.get("intent");

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
    if (!copy) return redirect("/utilities/rubric");
    return redirectWithFlash(`/utilities/rubric/${copy.id}`, "rubricDuplicated");
  }
  if (intent === "delete") {
    await deleteRubric(user.id, existing.id);
    return redirectWithFlash("/utilities/rubric", "rubricDeleted");
  }
  return { error: "invalid" as const };
}

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: data ? `${data.rubric.name} — LimeOnIt` : "LimeOnIt" }];
}

export default function RubricPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const r = t.utilities.rubric;
  const { rubric, group, rounds, selected, feedbackWith } = loaderData;
  const { sharing = { teams: [], sharedWith: [] } } = loaderData;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    result: (d) => {
      if (!d || !("intent" in d)) return null;
      return d.ok
        ? { variant: "success", message: d.message }
        : { variant: "error", message: d.error };
    },
  });
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
          <Link
            to={`/utilities/rubric/${rubric.id}/calibrate`}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <Scale className="size-4" aria-hidden />
            {t.rubricCalibrate.link}
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
      <RubricGroup
        group={group}
        rounds={rounds}
        selected={selected}
        feedbackWith={feedbackWith ?? undefined}
      />
      <div className="mt-10">
        <ShareWithTeam {...sharing} />
      </div>
    </div>
  );
}
