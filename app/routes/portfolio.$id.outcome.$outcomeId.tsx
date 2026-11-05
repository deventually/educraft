import { Form, Link, useActionData } from "react-router";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.outcome.$outcomeId";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import {
  CRITERION_STATUSES,
  EVIDENCE_KINDS,
  type Criterion,
  type DossierData,
  type EvidenceItem,
} from "~/lib/portfolio/types";
import { Button, Card, Input, Label, Select } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { EvidenceTextField } from "~/components/portfolio/EvidenceTextField";
import { ChapterEditor } from "~/components/portfolio/ChapterEditor";
import { CoachPanel } from "~/components/portfolio/CoachPanel";
import { ToolHints } from "~/components/portfolio/ToolHints";
import { availableToolNames, loadSuggestions } from "~/server/portfolio.server";
import { EvidenceSuggestions } from "~/components/portfolio/EvidenceSuggestions";
import { chapterHints, courseHint, criterionHints } from "~/lib/portfolio/toolHints";
import { snapshotCourses } from "~/server/courseEvidence.server";
import { fmtDate } from "~/lib/portfolio/format";
import { resolveModelInfo } from "~/lib/ai/models";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmt } from "~/lib/i18n/format";
import type { Messages } from "~/lib/i18n";

export function meta({ loaderData: data }: Route.MetaArgs) {
  return [{ title: `${data ? outcomeLabel(data.outcome) : "BDB/BKE"} — LimeOnIt` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, dossier } = await loadDossier(request, params.id);
  const d = dossier.data;
  const outcome = d.framework.outcomes.find((o) => o.id === params.outcomeId);
  if (!outcome) throw new Response("Not Found", { status: 404 });
  const own = new Set(outcome.criteria.map((c) => c.id));
  const linked = new Set(d.evidence.flatMap((e) => e.criterionIds));
  const names = await availableToolNames(request, user);
  const available = new Set(names.keys());
  const view = (slugs: string[]) => slugs.map((slug) => ({ slug, name: names.get(slug) ?? slug }));
  const allSuggestions = await loadSuggestions(request, user, d);
  return {
    id: dossier.id,
    name: dossier.name,
    outcome,
    status: Object.fromEntries(
      outcome.criteria.map((c) => [c.id, d.status[c.id] ?? "not-started"]),
    ),
    evidence: d.evidence.filter((e) => e.criterionIds.some((cid) => own.has(cid))),
    unlinked: d.evidence.filter((e) => e.criterionIds.length === 0),
    chapter: d.chapters.find((ch) => ch.outcomeId === outcome.id)?.text ?? "",
    maxWords: d.framework.requirements.maxWords,
    evidenceFull: d.evidence.length >= LIMITS.evidence,
    confirmed: d.framework.confirmedAt !== undefined,
    coachMode: d.coachMode,
    showDraftNotice: d.coachMode === "draft" && d.draftNoticeSeenAt === undefined,
    withEvidence: outcome.criteria
      .filter((c) => d.evidence.some((e) => e.criterionIds.includes(c.id)))
      .map((c) => c.id),
    stored: storedReview(d.reviews?.[outcome.id]),
    toolHints: Object.fromEntries(
      outcome.criteria
        .filter((c) => !linked.has(c.id))
        .map((c) => [c.id, view(criterionHints(outcome, c, available))]),
    ),
    chapterTools: view(chapterHints(outcome, available)),
    courseHints: outcome.criteria
      .filter((c) => !linked.has(c.id) && courseHint(c))
      .map((c) => c.id),
    snapshotCourses: await snapshotCourses(user.id, d),
    suggestions: Object.fromEntries(
      outcome.criteria.flatMap((c) => (allSuggestions[c.id] ? [[c.id, allSuggestions[c.id]]] : [])),
    ),
  };
}

function storedReview(r: NonNullable<DossierData["reviews"]>[string] | undefined) {
  if (!r) return undefined;
  let modelName = r.model;
  try {
    modelName = resolveModelInfo(r.model).displayName;
  } catch {
    // A model that left the catalog keeps its id as its name.
  }
  return { ...r, modelName };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

type PortfolioMessages = Messages["portfolio"];

export default function PortfolioOutcome({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const to = t.portfolio.outcome;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) => {
      const intent = String(fd?.get("intent") ?? "");
      if (intent === "review") return { variant: "pending", message: t.portfolio.coach.pending };
      if (intent.startsWith("draft:"))
        return { variant: "pending", message: t.portfolio.draft.pending };
      return { variant: "pending", message: t.toast.saving };
    },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      const message =
        r.intent === "refreshCourseEvidence"
          ? t.portfolio.outcome.refreshed
          : r.intent === "review"
            ? t.portfolio.coach.done
            : r.intent === "draft"
              ? t.portfolio.draft.done
              : t.portfolio.toastSaved;
      return { variant: "success", message };
    },
  });
  const {
    id,
    outcome,
    status,
    evidence,
    unlinked,
    chapter,
    maxWords,
    evidenceFull,
    confirmed,
    coachMode,
    showDraftNotice,
    withEvidence,
    stored,
    toolHints,
    chapterTools,
    suggestions,
    courseHints = [],
    snapshotCourses = {},
  } = loaderData;
  const drafts =
    coachMode === "draft" && confirmed
      ? outcome.criteria.map((c, i) => ({
          criterionId: c.id,
          n: i + 1,
          hasEvidence: withEvidence.includes(c.id),
        }))
      : undefined;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to={`/portfolio/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.portfolio.backToDossier}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {outcomeLabel(outcome)}
      </h1>

      <section className="mt-6" aria-labelledby="criteria-title">
        <h2 id="criteria-title" className="text-lg font-medium text-slate-900">
          {to.criteriaTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{to.criteriaIntro}</p>
        <ol className="mt-3 space-y-3">
          {outcome.criteria.map((c, i) => (
            <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-slate-900">
                <span className="font-medium">{i + 1}.</span> {c.text}
              </p>
              {c.strongLevel && (
                <p className="mt-1 text-sm text-slate-600">
                  {fmt(to.strongLevel, { text: c.strongLevel })}
                </p>
              )}
              <EvidenceSuggestions
                criterionId={c.id}
                n={i + 1}
                suggestions={suggestions[c.id] ?? []}
                className="mt-3"
              />
              <ToolHints
                hints={toolHints[c.id] ?? []}
                step="evidence"
                from={{ dossierId: id, criterionId: c.id }}
                course={courseHints.includes(c.id)}
                className="mt-3"
              />
              <Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="intent" value="setStatus" />
                <input type="hidden" name="criterionId" value={c.id} />
                <div>
                  <Label htmlFor={`status-${c.id}`}>
                    {to.statusLabel} {i + 1}
                  </Label>
                  <Select id={`status-${c.id}`} name="status" defaultValue={status[c.id]}>
                    {CRITERION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t.portfolio.status[s]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  {to.saveStatus}
                </Button>
              </Form>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="evidence-title">
        <h2 id="evidence-title" className="text-lg font-medium text-slate-900">
          {to.evidenceTitle}
        </h2>
        {evidence.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{to.evidenceEmpty}</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {evidence.map((e) => (
              <EvidenceRow
                key={e.id}
                item={e}
                outcomeId={outcome.id}
                criteria={outcome.criteria}
                courses={snapshotCourses}
                t={t.portfolio}
              />
            ))}
          </ul>
        )}
        {unlinked.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-medium text-slate-900">{to.unlinkedTitle}</h3>
            <ul className="mt-2 space-y-3">
              {unlinked.map((e) => (
                <EvidenceRow
                  key={e.id}
                  item={e}
                  outcomeId={outcome.id}
                  criteria={outcome.criteria}
                  courses={snapshotCourses}
                  t={t.portfolio}
                />
              ))}
            </ul>
          </>
        )}

        {!evidenceFull && (
          <Card className="mt-6 p-5">
            <h3 className="text-base font-medium text-slate-900">{to.addEvidenceTitle}</h3>
            {/* Keyed on the evidence count: a saved item resets the form. */}
            <Form key={evidence.length + unlinked.length} method="post" className="mt-3 grid gap-3">
              <input type="hidden" name="intent" value="addEvidence" />
              <input type="hidden" name="outcomeId" value={outcome.id} />
              <EvidenceFields prefix="new-evidence" criteria={outcome.criteria} t={t.portfolio} />
              <div>
                <Button type="submit">{to.addEvidence}</Button>
              </div>
            </Form>
          </Card>
        )}
      </section>

      <section className="mt-8" aria-labelledby="chapter-title">
        <h2 id="chapter-title" className="text-lg font-medium text-slate-900">
          {to.chapterTitle}
        </h2>
        {showDraftNotice && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-800">{t.portfolio.draft.notice}</p>
            <Form method="post" className="mt-2">
              <input type="hidden" name="intent" value="dismissDraftNotice" />
              <Button type="submit" variant="secondary" size="sm">
                {t.portfolio.draft.noticeOk}
              </Button>
            </Form>
          </div>
        )}
        <ToolHints hints={chapterTools} step="chapter" className="mt-3" />
        <div className="mt-3">
          {/* Keyed on the saved text: a drafted paragraph reloads the editor. */}
          <ChapterEditor
            key={`${chapter.length}:${chapter.slice(-40)}`}
            outcomeId={outcome.id}
            defaultValue={chapter}
            maxWords={maxWords}
            drafts={drafts}
          />
        </div>
      </section>

      <CoachPanel
        dossierId={id}
        outcomeId={outcome.id}
        criteria={outcome.criteria}
        status={status}
        confirmed={confirmed}
        hasChapter={chapter.trim().length > 0}
        stored={stored}
      />
    </div>
  );
}

function EvidenceFields({
  prefix,
  criteria,
  item,
  t,
}: {
  prefix: string;
  criteria: Criterion[];
  item?: EvidenceItem;
  t: PortfolioMessages;
}) {
  const linked = new Set(item?.criterionIds ?? []);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div>
          <Label htmlFor={`${prefix}-title`}>{t.outcome.evidenceTitleLabel}</Label>
          <Input
            id={`${prefix}-title`}
            name="title"
            required
            maxLength={LIMITS.title}
            defaultValue={item?.title ?? ""}
          />
        </div>
        <div>
          <Label htmlFor={`${prefix}-kind`}>{t.outcome.evidenceKind}</Label>
          <Select id={`${prefix}-kind`} name="kind" defaultValue={item?.kind ?? "other"}>
            {EVIDENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t.kinds[k]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <EvidenceTextField id={`${prefix}-text`} defaultValue={item?.text ?? ""} />
      {criteria.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">
            {t.outcome.evidenceCriteria}
          </legend>
          <div className="mt-2 space-y-1">
            {criteria.map((c, i) => (
              <label key={c.id} className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="criterionIds"
                  value={c.id}
                  defaultChecked={linked.has(c.id)}
                  className="mt-1"
                />
                <span>
                  {i + 1}. {c.text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}

function EvidenceRow({
  item,
  outcomeId,
  criteria,
  courses,
  t,
}: {
  item: EvidenceItem;
  outcomeId: string;
  criteria: Criterion[];
  /** courseId → name, or null when the course is gone (P26.4). */
  courses: Record<string, string | null>;
  t: PortfolioMessages;
}) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <details>
        <summary className="cursor-pointer px-4 py-3">
          <span className="font-medium text-slate-900">{item.title}</span>{" "}
          <span className="text-sm text-slate-600">· {t.kinds[item.kind]}</span>
        </summary>
        <div className="border-t border-slate-100 p-4">
          {item.sourceCourse && (
            <CourseSnapshot
              evidenceId={item.id}
              source={item.sourceCourse}
              courseName={courses[item.sourceCourse.courseId] ?? null}
              t={t}
            />
          )}
          <Form method="post" className="grid gap-3">
            <input type="hidden" name="intent" value="updateEvidence" />
            <input type="hidden" name="outcomeId" value={outcomeId} />
            <input type="hidden" name="evidenceId" value={item.id} />
            <EvidenceFields prefix={`ev-${item.id}`} criteria={criteria} item={item} t={t} />
            <div>
              <Button type="submit" variant="secondary" size="sm">
                {t.outcome.saveEvidence}
              </Button>
            </div>
          </Form>
          <Form method="post" className="mt-2">
            <input type="hidden" name="intent" value="removeEvidence" />
            <input type="hidden" name="evidenceId" value={item.id} />
            <Button
              type="submit"
              variant="danger"
              size="sm"
              aria-label={`${t.outcome.removeEvidence}: ${item.title}`}
            >
              <Trash2 className="size-4" aria-hidden />
              {t.outcome.removeEvidence}
            </Button>
          </Form>
        </div>
      </details>
    </li>
  );
}

/** Where a snapshot comes from, with a way to the course and "Opnieuw ophalen" (P26.4). */
function CourseSnapshot({
  evidenceId,
  source,
  courseName,
  t,
}: {
  evidenceId: string;
  source: NonNullable<EvidenceItem["sourceCourse"]>;
  courseName: string | null;
  t: PortfolioMessages;
}) {
  const locale = useLocale();
  const date = fmtDate(source.at, locale);
  if (courseName === null)
    return <p className="mb-3 text-sm text-slate-600">{fmt(t.outcome.fromGoneCourse, { date })}</p>;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
      <p>{fmt(t.outcome.fromCourse, { course: courseName, date })}</p>
      <Link
        to={`/courses/${source.courseId}`}
        className="font-medium text-violet-700 underline underline-offset-2"
      >
        {t.outcome.openCourse}
      </Link>
      <Form method="post">
        <input type="hidden" name="intent" value="refreshCourseEvidence" />
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <Button type="submit" variant="secondary" size="sm">
          {t.outcome.refresh}
        </Button>
      </Form>
    </div>
  );
}
