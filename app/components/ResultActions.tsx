import { useId, useState, type FormEvent } from "react";
import { Link, useFetcher } from "react-router";
import { ArrowRight, BookmarkCheck, FolderCheck, GraduationCap } from "lucide-react";
import { Button, Label, Select } from "./ui";
import { useActionToast } from "./Toast";
import { FeedbackWidget } from "./FeedbackWidget";
import { ExportMenu } from "./export/ExportMenu";
import { type LinkTarget, linkTargetValue } from "~/lib/courses/links";
import { fmt } from "~/lib/i18n/format";
import { loc, type LocalizedText } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";

export interface ResultActionsProps {
  /** The saved work; null while nothing is saved (then only the next steps show). */
  generationId: string | null;
  /** The course the work was made for ("" = none). It is linked already (P20.4). */
  courseId: string;
  /** The course item the work was made for (P27.4); a next step carries it on. */
  itemId?: string;
  nextTools: { slug: string; name: LocalizedText }[];
  linkTargets: LinkTarget[];
  dossiers: { id: string; name: string; criteria: { id: string; label: string }[] }[];
  /** P27.2: the tool was opened from this dossier criterion; one button puts the result there. */
  forCriterion?: { dossierId: string; criterionId: string } | null;
  /** P30.1: the other saved steps of a multi-step tool, exported along with this one. */
  exportWith?: string[];
}

/** What the tool page passes down to every result surface (P27.1). */
export type ResultContext = Omit<
  ResultActionsProps,
  "generationId" | "courseId" | "itemId" | "exportWith"
>;

type ActionResult = { ok: true; intent?: string } | { ok: false; error?: string };

const SEP = "::";

/**
 * Under a result (P27.1): the logical next steps, and keeping the result with a course
 * or as evidence in a BDB/BKE dossier. Once saved, the pilot feedback (thumb, time
 * saved, quality, comment) sits right below it. Posts to the tool route's action without leaving
 * the page, so the result stays on screen.
 */
export function ResultActions({
  generationId,
  courseId,
  itemId = "",
  nextTools,
  linkTargets,
  dossiers,
  forCriterion = null,
  exportWith = [],
}: ResultActionsProps) {
  const t = useT();
  const m = t.resultActions;
  const locale = useLocale();
  const headingId = useId();
  const courseSelectId = useId();
  const evidenceSelectId = useId();
  const courseFetcher = useFetcher<ActionResult>();
  const evidenceFetcher = useFetcher<ActionResult>();
  const [linkedTo, setLinkedTo] = useState(courseId);

  useActionToast(courseFetcher.data, (d) =>
    d.ok
      ? { variant: "success", message: m.toastSaved }
      : d.error
        ? { variant: "error", message: d.error }
        : null,
  );
  useActionToast(evidenceFetcher.data, (d) =>
    d.ok
      ? { variant: "success", message: m.toastEvidence }
      : d.error
        ? { variant: "error", message: d.error }
        : null,
  );

  const keptAt = courseId || (courseFetcher.data?.ok ? linkedTo : "");
  const keptName = linkTargets.find((c) => c.courseId === keptAt)?.courseName;
  const canKeep = Boolean(generationId);
  const showCriterion = canKeep && forCriterion !== null;
  const showEvidence = canKeep && !showCriterion && dossiers.length > 0;
  // Saved work can always be exported (P30.1).
  const hasActions = nextTools.length > 0 || canKeep;
  if (!hasActions && !generationId) return null;

  const query = courseId
    ? `?course=${encodeURIComponent(courseId)}${itemId ? `&item=${encodeURIComponent(itemId)}` : ""}`
    : "";

  function keepAtCourse(e: FormEvent<HTMLFormElement>) {
    const target = String(new FormData(e.currentTarget).get("target") ?? "");
    setLinkedTo(target.split(SEP)[0] ?? "");
  }

  function submitEvidence(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const [dossierId = "", criterionId = ""] = String(
      new FormData(e.currentTarget).get("evidenceTarget") ?? "",
    ).split(SEP);
    void evidenceFetcher.submit(
      { intent: "addToDossier", id: generationId ?? "", dossierId, criterionId },
      { method: "post" },
    );
  }

  return (
    <div className="space-y-3">
      {hasActions && (
        <section
          aria-labelledby={headingId}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 id={headingId} className="text-sm font-semibold text-slate-800">
            {m.heading}
          </h2>

          {nextTools.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{m.next}</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {nextTools.map((n) => (
                  <li key={n.slug}>
                    <Link
                      to={`/tools/${n.slug}${query}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-lime-300 bg-lime-50 px-3 py-1.5 text-sm font-medium text-lime-900 hover:bg-lime-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-700"
                    >
                      {loc(n.name, locale)}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {generationId && <ExportMenu generationId={generationId} with={exportWith} />}

          {canKeep && keptName && (
            <p className="flex items-center gap-1.5 text-sm text-slate-700">
              <BookmarkCheck className="size-4 text-lime-700" aria-hidden />
              {fmt(m.savedIn, { course: keptName })}
            </p>
          )}

          {canKeep && !keptName && linkTargets.length > 0 && (
            <courseFetcher.Form
              method="post"
              onSubmit={keepAtCourse}
              className="flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="intent" value="linkCourse" />
              <input type="hidden" name="id" value={generationId ?? ""} />
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <Label htmlFor={courseSelectId}>{m.courseLabel}</Label>
                <Select id={courseSelectId} name="target" className="w-full">
                  {linkTargets.map((c) => (
                    <optgroup key={c.courseId} label={c.courseName}>
                      <option value={linkTargetValue(c.courseId)}>
                        {fmt(m.wholeCourse, { course: c.courseName })}
                      </option>
                      {c.items.map((i) => (
                        <option key={i.id} value={linkTargetValue(c.courseId, i.id)}>
                          {i.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                <GraduationCap className="size-4" aria-hidden />
                {m.saveToCourse}
              </Button>
            </courseFetcher.Form>
          )}

          {showCriterion && forCriterion && (
            <evidenceFetcher.Form method="post">
              <input type="hidden" name="intent" value="addToDossier" />
              <input type="hidden" name="id" value={generationId ?? ""} />
              <input type="hidden" name="dossierId" value={forCriterion.dossierId} />
              <input type="hidden" name="criterionId" value={forCriterion.criterionId} />
              <Button type="submit" size="sm">
                <FolderCheck className="size-4" aria-hidden />
                {m.putAtCriterion}
              </Button>
            </evidenceFetcher.Form>
          )}

          {showEvidence && (
            <evidenceFetcher.Form
              method="post"
              onSubmit={submitEvidence}
              className="flex flex-wrap items-end gap-2"
            >
              <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                <Label htmlFor={evidenceSelectId}>{m.evidenceLabel}</Label>
                <Select id={evidenceSelectId} name="evidenceTarget" className="w-full">
                  {dossiers.map((d) => (
                    <optgroup key={d.id} label={d.name}>
                      <option value={d.id}>{fmt(m.wholeDossier, { dossier: d.name })}</option>
                      {d.criteria.map((c) => (
                        <option key={c.id} value={`${d.id}${SEP}${c.id}`}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </div>
              <Button type="submit" variant="secondary" size="sm">
                {m.useAsEvidence}
              </Button>
            </evidenceFetcher.Form>
          )}
        </section>
      )}
      {generationId && <FeedbackWidget key={generationId} generationId={generationId} />}
    </div>
  );
}
