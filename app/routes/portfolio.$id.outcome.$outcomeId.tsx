import { Form, Link, useActionData, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import type { Route } from "./+types/portfolio.$id.outcome.$outcomeId";
import { loadDossier, saveIntent } from "~/server/portfolio.server";
import { outcomeLabel } from "~/lib/portfolio/format";
import { LIMITS } from "~/lib/portfolio/schema";
import type { DossierData } from "~/lib/portfolio/types";
import { Button, Card } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { EvidenceFields, EvidenceRow } from "~/components/portfolio/EvidenceRow";
import { ChapterEditor } from "~/components/portfolio/ChapterEditor";
import { ChapterOutline } from "~/components/portfolio/ChapterOutline";
import { CoachPanel } from "~/components/portfolio/CoachPanel";
import { ProofreadPanel } from "~/components/portfolio/ProofreadPanel";
import { ToolHints } from "~/components/portfolio/ToolHints";
import { availableToolNames, loadSuggestions, modelDisplayName } from "~/server/portfolio.server";
import { EvidenceSuggestions } from "~/components/portfolio/EvidenceSuggestions";
import { chapterHints, courseHint, criterionHints } from "~/lib/portfolio/toolHints";
import { snapshotCourses } from "~/server/courseEvidence.server";
import { useT } from "~/lib/i18n/useT";
import { ProvisionalNotice } from "~/components/portfolio/ProvisionalNotice";
import { evidencePending } from "~/lib/portfolio/evidence";
import { outcomeRoute } from "~/lib/portfolio/route";
import { requirementChecklist } from "~/lib/portfolio/requirements";
import { RequiredEvidence } from "~/components/portfolio/RequiredEvidence";
import { OutcomeProgress } from "~/components/portfolio/DossierProgress";
import { TabNav } from "~/components/TabNav";
import { CriteriaOverview, StatusList } from "~/components/portfolio/CriteriaLists";
import { OUTCOME_TABS, outcomeHref, outcomeTab } from "~/lib/portfolio/tabs";

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
    provisional: d.framework.provisional === true,
    coachMode: d.coachMode,
    showDraftNotice: d.coachMode === "draft" && d.draftNoticeSeenAt === undefined,
    withEvidence: outcome.criteria
      .filter((c) => d.evidence.some((e) => e.criterionIds.includes(c.id) && !evidencePending(e)))
      .map((c) => c.id),
    stored: storedReview(d.reviews?.[outcome.id]),
    proofread: storedProofread(d, outcome.id),
    toolHints: Object.fromEntries(
      outcome.criteria
        .filter((c) => !linked.has(c.id))
        .map((c) => [c.id, view(criterionHints(outcome, c, available))]),
    ),
    chapterTools: view(chapterHints(outcome, available)),
    // The four milestones of this outcome, guiding the page (always found: the outcome is).
    milestones: outcomeRoute(d, outcome.id)?.milestones ?? [],
    required: requirementChecklist(d, outcome.id),
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
  return { ...r, modelName: modelDisplayName(r.model) };
}

/** The latest proofreading, with only the proposals whose span is still in the chapter. */
function storedProofread(d: DossierData, outcomeId: string) {
  const p = d.proofreads?.[outcomeId];
  if (!p) return undefined;
  const chapter = d.chapters.find((ch) => ch.outcomeId === outcomeId)?.text ?? "";
  return {
    at: p.at,
    modelName: modelDisplayName(p.model),
    suggestions: p.suggestions.flatMap((s, index) =>
      chapter.includes(s.quote) ? [{ ...s, index }] : [],
    ),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  return saveIntent(request, params.id);
}

export default function PortfolioOutcome({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const to = t.portfolio.outcome;
  const actionData = useActionData<typeof action>();
  useFormToast(actionData, {
    pending: (fd) => {
      const intent = String(fd?.get("intent") ?? "");
      if (intent === "review") return { variant: "pending", message: t.portfolio.coach.pending };
      if (intent === "proofread")
        return { variant: "pending", message: t.portfolio.proofread.pending };
      if (intent.startsWith("draft:"))
        return { variant: "pending", message: t.portfolio.draft.pending };
      return { variant: "pending", message: t.toast.saving };
    },
    result: (r) => {
      if (!r) return null;
      if (!r.ok) return { variant: "error", message: r.error };
      const tr = t.portfolio.proofread;
      const message =
        r.intent === "refreshCourseEvidence"
          ? t.portfolio.outcome.refreshed
          : r.intent === "review"
            ? t.portfolio.coach.done
            : r.intent === "draft"
              ? t.portfolio.draft.done
              : r.intent === "proofread"
                ? r.proposals
                  ? tr.done
                  : tr.doneNone
                : r.intent === "takeProofread"
                  ? tr.taken
                  : r.intent === "skipProofread"
                    ? tr.skipped
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
    provisional = false,
    coachMode,
    showDraftNotice,
    withEvidence,
    stored,
    proofread,
    toolHints,
    chapterTools,
    suggestions,
    courseHints = [],
    snapshotCourses = {},
    milestones = [],
    required = [],
  } = loaderData;
  const [params] = useSearchParams();
  const drafts =
    coachMode === "draft" && confirmed
      ? outcome.criteria.map((c, i) => ({
          criterionId: c.id,
          n: i + 1,
          hasEvidence: withEvidence.includes(c.id),
        }))
      : undefined;

  const tab = outcomeTab(params.get("tab"));
  const tr = t.portfolioRoute;

  return (
    <div className="w-full min-w-0">
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
      {provisional && <ProvisionalNotice className="mt-3" />}

      <div className="mt-6">
        <TabNav
          label={tr.tabs.outcomeLabel}
          current={tab}
          tabs={OUTCOME_TABS.map((x) => ({
            id: x,
            label: tr.tabs[x],
            href: outcomeHref(id, outcome.id, x),
          }))}
        />
      </div>

      {tab === "overview" && (
        <>
          {milestones.length > 0 && (
            <OutcomeProgress dossierId={id} outcomeId={outcome.id} milestones={milestones} />
          )}
          <CriteriaOverview criteria={outcome.criteria} />
        </>
      )}

      {tab === "evidence" && (
        <>
          <RequiredEvidence
            outcomeId={outcome.id}
            items={required}
            evidence={[...evidence, ...unlinked].map(({ id, title }) => ({ id, title }))}
          />
          <section className="mt-6" aria-labelledby="per-criterion-title">
            <h2 id="per-criterion-title" className="text-lg font-medium text-slate-900">
              {tr.tabs.perCriterionTitle}
            </h2>
            <ol className="mt-3 space-y-3">
              {outcome.criteria.map((c, i) => (
                <li
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-slate-900">
                    <span className="font-medium">{i + 1}.</span> {c.text}
                  </p>
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
                    />
                  ))}
                </ul>
              </>
            )}

            {!evidenceFull && (
              <Card className="mt-6 p-5">
                <h3
                  id="add-evidence-title"
                  className="scroll-mt-4 text-base font-medium text-slate-900"
                >
                  {to.addEvidenceTitle}
                </h3>
                {/* Keyed on the evidence count: a saved item resets the form. */}
                <Form
                  key={evidence.length + unlinked.length}
                  method="post"
                  className="mt-3 grid gap-3"
                >
                  <input type="hidden" name="intent" value="addEvidence" />
                  <input type="hidden" name="outcomeId" value={outcome.id} />
                  <EvidenceFields prefix="new-evidence" criteria={outcome.criteria} />
                  <div>
                    <Button type="submit">{to.addEvidence}</Button>
                  </div>
                </Form>
              </Card>
            )}
          </section>
        </>
      )}

      {tab === "chapter" && (
        <>
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
            <ChapterOutline outcome={outcome} />
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
        </>
      )}

      {tab === "review" && (
        <>
          <CoachPanel
            dossierId={id}
            outcomeId={outcome.id}
            criteria={outcome.criteria}
            status={status}
            confirmed={confirmed}
            hasChapter={chapter.trim().length > 0}
            stored={stored}
            proofread={!!proofread}
          />
          {proofread && <ProofreadPanel outcomeId={outcome.id} view={proofread} />}
          <StatusList criteria={outcome.criteria} status={status} />
        </>
      )}
    </div>
  );
}
