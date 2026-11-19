import { Link, useActionData } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/courses.$id.assessments.$assessmentId.note";
import { dossierNoteAction, dossierNotePage } from "~/server/dossierNote.server";
import { DossierNoteEditor } from "~/components/courses/DossierNoteEditor";
import { useFormToast } from "~/components/Toast";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data?.assessment.title ?? ""} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return dossierNotePage(request, params);
}

export async function action({ request, params }: Route.ActionArgs) {
  return dossierNoteAction(request, params);
}

/**
 * The teacher's own notes on the test analysis, for the test dossier (brief P35.2): their text,
 * and on request a concept by the AI with one or two reflection questions to rewrite from.
 */
export default function DossierNotePage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const m = t.dossierNote;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) => ({
      variant: "pending",
      message: fd?.get("intent") === "draft-note" ? m.pending : t.toast.saving,
    }),
    result: (r) => {
      if (!r) return null;
      // The gate's question takes focus itself; a toast would say it twice.
      if (!r.ok) return "privacyReview" in r ? null : { variant: "error", message: r.error };
      return { variant: "success", message: r.intent === "draft-note" ? m.done : m.saved };
    },
  });
  const { course, assessment } = loaderData;
  return (
    <div className="w-full min-w-0">
      <Link
        to={`/courses/${encodeURIComponent(course.id)}?tab=plan`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {m.back}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {fmt(m.title, { test: assessment.title })}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{course.name}</p>
      <DossierNoteEditor
        analysis={loaderData.analysis}
        note={loaderData.note}
        draft={actionData?.ok && actionData.intent === "draft-note" ? actionData.note : null}
        models={loaderData.models}
        answer={actionData}
        privacy={loaderData.privacy}
      />
    </div>
  );
}
