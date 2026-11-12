import { type ReactNode, useId } from "react";
import { isFeatureOn } from "~/server/availability.server";
import { Form, Link, useActionData } from "react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { z } from "zod";
import type { Route } from "./+types/tracks.$id";
import { requireTracksUser, trackVisitAction } from "~/server/tracks.server";
import { rubricChoices, trackSecondAssessorAction } from "~/server/trackSecondAssessor.server";
import { trackCloseAction, trackOnStageAction } from "~/server/trackOnStage.server";
import { getTrackRetentionDays } from "~/server/repositories/settings.server";
import { SecondAssessorPanel } from "~/components/tracks/SecondAssessorPanel";
import { VisitsPanel } from "~/components/tracks/VisitsPanel";
import { OnStagePanel } from "~/components/tracks/OnStagePanel";
import { CloseTrack } from "~/components/tracks/CloseTrack";
import { getTrack, listRounds, updateTrackData } from "~/server/repositories/tracks.server";
import { getCourse } from "~/server/repositories/courses.server";
import { getAssessmentModel } from "~/server/repositories/assessmentModels.server";
import { IsoDateSchema } from "~/lib/calendar/weeks";
import {
  MILESTONES,
  type MilestoneId,
  MilestoneIdSchema,
  type MilestonePanel,
  nextStep,
  progress,
} from "~/lib/tracks";
import { TabNav } from "~/components/TabNav";
import { ProgressPanel } from "~/components/progress/ProgressPanel";
import { Markdown } from "~/components/Markdown";
import { Button, Input, Label } from "~/components/ui";
import { useFormToast } from "~/components/Toast";
import { getMessages } from "~/lib/i18n";
import { getLocale } from "~/lib/i18n/locale.server";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { fmtDate } from "~/lib/portfolio/format";

export function meta() {
  return [{ title: "Traject — LimeOnIt" }];
}

const notFound = () => new Response("Not Found", { status: 404 });
const tabOf = (v: string | null): "overview" | MilestoneId => {
  const m = MilestoneIdSchema.safeParse(v);
  return m.success ? m.data : "overview";
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireTracksUser(request);
  const track = await getTrack(user.id, params.id ?? "");
  if (!track) throw notFound();
  const tab = tabOf(new URL(request.url).searchParams.get("tab"));
  const panel = tab === "overview" ? undefined : MILESTONES.find((x) => x.id === tab)?.panel;
  const [rounds, course, model, rubrics, rubricsOn, retentionDays] = await Promise.all([
    listRounds(user.id, track.id),
    track.courseId ? getCourse(user.id, track.courseId) : null,
    track.assessmentModelId ? getAssessmentModel(user.id, track.assessmentModelId) : null,
    // The rubrics only on the tab that compares with them (P38.5).
    panel === "second-assessor" ? rubricChoices(user) : [],
    // The rubrics live under Hulpmiddelen: without it the link would be a 404.
    isFeatureOn(user, "utilities"),
    getTrackRetentionDays(),
  ]);
  return {
    tab,
    rubrics,
    rubricsOn,
    retentionDays,
    track: {
      id: track.id,
      code: track.code,
      kind: track.kind,
      courseName: course?.name ?? null,
      modelName: model?.name ?? null,
      // The criteria from the linked assessment model, for the OnStage texts (P38.7).
      criteria: model?.data.framework ?? "",
      closedAt: track.closedAt,
      purgeAfter: track.purgeAfter,
    },
    data: track.data,
    rounds: rounds.map((r) => ({
      id: r.id,
      milestone: r.milestone,
      round: r.round,
      feedback: r.feedback,
      createdAt: r.createdAt,
    })),
  };
}

const MilestoneFormSchema = z.object({
  milestone: MilestoneIdSchema,
  status: z.enum(["open", "done", "skipped"]),
  due: z.union([z.literal(""), IsoDateSchema]),
});

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireTracksUser(request);
  const track = await getTrack(user.id, params.id ?? "");
  if (!track) throw notFound();
  const locale = getLocale(request);
  const sa = await trackSecondAssessorAction(request, user, track, locale);
  if (sa) return sa;
  const visit = await trackVisitAction(request, user, track, locale);
  if (visit) return visit;
  const onstage = await trackOnStageAction(request, user, track, locale);
  if (onstage) return onstage;
  const close = await trackCloseAction(request, user, track, locale);
  if (close) return close;
  const fd = await request.formData();
  const m = getMessages(locale).tracks;
  if (fd.get("intent") !== "milestone")
    return { ok: false as const, intent: "milestone" as const, error: m.errorInvalid };
  const form = MilestoneFormSchema.safeParse({
    milestone: fd.get("milestone"),
    status: fd.get("status"),
    due: fd.get("due") ?? "",
  });
  if (!form.success)
    return { ok: false as const, intent: "milestone" as const, error: m.errorInvalid };
  const { milestone, status, due } = form.data;
  const { [milestone]: _old, ...deadlines } = track.data.deadlines;
  await updateTrackData(user.id, track.id, {
    ...track.data,
    status: { ...track.data.status, [milestone]: status },
    deadlines: due ? { ...deadlines, [milestone]: due } : deadlines,
  });
  return { ok: true as const, intent: "milestone" as const };
}

type Data = Route.ComponentProps["loaderData"];

export default function TrackPage({ loaderData }: Route.ComponentProps) {
  const t = useT();
  const m = t.tracks;
  const locale = useLocale();
  const actionData = useActionData<typeof action>();
  const { tab, track } = loaderData;
  const doneMessage = {
    "second-assessor": m.secondAssessor.done,
    visit: m.visits.done,
    onstage: m.onstage.done,
    close: m.close.done,
    milestone: m.toastSaved,
  };
  useFormToast(actionData, {
    result: (d) =>
      d
        ? d.ok
          ? { variant: "success", message: doneMessage[d.intent] }
          : { variant: "error", message: d.error }
        : null,
  });
  const href = (id: string) =>
    id === "overview" ? `/tracks/${track.id}` : `/tracks/${track.id}?tab=${id}`;
  const tabs = [
    { id: "overview", label: m.overview, href: href("overview") },
    ...MILESTONES.map((x) => ({ id: x.id, label: loc(x.name, locale), href: href(x.id) })),
  ];
  const kind = track.kind === "thesis" ? m.kindThesis : m.kindInternship;

  return (
    <div className="w-full min-w-0">
      <Link
        to="/tracks"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {m.allTracks}
      </Link>
      <h1 className="mt-2 font-display text-2xl font-medium tracking-tight text-slate-900">
        {fmt(m.title, { code: track.code })}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {kind} ·{" "}
        {fmt(m.linkedTo, {
          course: track.courseName ?? m.notLinked,
          model: track.modelName ?? m.notLinked,
        })}
      </p>
      <div className="mt-6">
        <TabNav label={m.tabs} tabs={tabs} current={tab} />
      </div>
      <div className="mt-6">
        {tab === "overview" ? (
          <Overview data={loaderData} href={href} />
        ) : (
          <MilestoneTab data={loaderData} milestone={tab} />
        )}
      </div>
    </div>
  );
}

function Overview({ data, href }: { data: Data; href: (id: string) => string }) {
  const t = useT();
  const m = t.tracks;
  const locale = useLocale();
  const state = { data: data.data, closedAt: data.track.closedAt };
  const p = progress(state);
  const next = nextStep(state);
  const statusLabel = {
    open: m.milestone.statusOpen,
    done: m.milestone.statusDone,
    skipped: m.milestone.statusSkipped,
  };
  const name = (id: MilestoneId) =>
    loc(MILESTONES.find((x) => x.id === id)?.name ?? { nl: id, en: id }, locale);
  return (
    <ProgressPanel
      title={m.steps}
      intro={m.overviewIntro}
      summary={fmt(m.progress, p)}
      stepsLabel={m.steps}
      steps={MILESTONES.map((x) => {
        const status = data.data.status[x.id] ?? "open";
        const due = data.data.deadlines[x.id];
        return {
          id: x.id,
          label: x.optional
            ? fmt(m.optional, { milestone: loc(x.name, locale) })
            : loc(x.name, locale),
          status: due
            ? `${statusLabel[status]} · ${fmt(m.dueOn, { date: fmtDate(due, locale) })}`
            : statusLabel[status],
          complete: status !== "open",
          href: href(x.id),
        };
      })}
      next={
        next && {
          id: next.milestone,
          heading: fmt(m.milestone.next, { milestone: name(next.milestone) }),
          how: m.milestone.how,
          cta: fmt(m.milestone.cta, { milestone: name(next.milestone) }),
          href: href(next.milestone),
        }
      }
      allDone={m.milestone.allDone}
    />
  );
}

/** The working panel of a milestone, by its data (`Milestone.panel`). */
function Panel({ kind, data }: { kind: MilestonePanel; data: Data }) {
  const panels: Record<MilestonePanel, () => ReactNode> = {
    "second-assessor": () => (
      <SecondAssessorPanel rubrics={data.rubrics} rubricsOn={data.rubricsOn} />
    ),
    visits: () => <VisitsPanel visits={data.data.visits} />,
    onstage: () => (
      <OnStagePanel
        criteria={data.track.criteria}
        confirmed={data.data.onstage}
        rounds={data.rounds}
      />
    ),
  };
  return panels[kind]();
}

function MilestoneTab({ data, milestone }: { data: Data; milestone: MilestoneId }) {
  const t = useT();
  const m = t.tracks;
  const locale = useLocale();
  const headingId = useId();
  const roundsId = useId();
  const def = MILESTONES.find((x) => x.id === milestone);
  const tools = def?.tools ?? [];
  const status = data.data.status[milestone] ?? "open";
  const rounds = data.rounds.filter((r) => r.milestone === milestone);
  const options = [
    { value: "open", label: m.milestone.statusOpen },
    { value: "done", label: m.milestone.statusDone },
    { value: "skipped", label: m.milestone.statusSkipped },
  ];
  return (
    <section aria-labelledby={headingId} className="space-y-6">
      <h2 id={headingId} className="text-lg font-medium text-slate-900">
        {def ? loc(def.name, locale) : milestone}
      </h2>
      {tools.length > 0 && !data.track.closedAt && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="max-w-[65ch] text-sm text-slate-700">{m.milestone.toolHint}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tools.map((tool) => (
              <Link
                key={tool.slug}
                to={`/tools/${tool.slug}?track=${encodeURIComponent(data.track.id)}&milestone=${milestone}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              >
                {loc(tool.label, locale)}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      )}
      {def?.panel && !data.track.closedAt && <Panel kind={def.panel} data={data} />}
      {def?.closes && (
        <CloseTrack
          track={data.track}
          retentionDays={data.retentionDays}
          rounds={data.rounds}
          onstage={data.data.onstage}
        />
      )}
      <Form method="post" key={milestone} className="space-y-4">
        <input type="hidden" name="intent" value="milestone" />
        <input type="hidden" name="milestone" value={milestone} />
        <fieldset>
          <legend className="text-sm font-medium text-slate-700">{m.milestone.stand}</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="status"
                  value={o.value}
                  defaultChecked={status === o.value}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="max-w-xs">
          <Label htmlFor={`due-${milestone}`}>{m.due}</Label>
          <Input
            id={`due-${milestone}`}
            name="due"
            type="date"
            defaultValue={data.data.deadlines[milestone] ?? ""}
          />
        </div>
        <Button type="submit" variant="secondary" size="sm">
          {m.milestone.save}
        </Button>
      </Form>
      <section aria-labelledby={roundsId}>
        <h3 id={roundsId} className="text-base font-medium text-slate-900">
          {m.milestone.rounds}
        </h3>
        {rounds.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{m.milestone.noRounds}</p>
        ) : (
          <ol className="mt-3 space-y-4">
            {rounds.map((r) => (
              <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="font-medium text-slate-900">
                  {fmt(m.milestone.round, { round: r.round })}
                </h4>
                <p className="text-xs text-slate-500">{fmtDate(r.createdAt, locale)}</p>
                <div className="prose prose-sm mt-2 max-w-none">
                  <Markdown>{r.feedback.text}</Markdown>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
