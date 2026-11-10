import { useId, useState } from "react";
import { Form, Link } from "react-router";
import { AlertTriangle, Info } from "lucide-react";
import {
  DECISION_REASON_MAX,
  type ReviewFinding,
  type ReviewPanelAgent,
  type ReviewPanelChoice,
} from "~/lib/agents/types";
import type { CourseData } from "~/lib/courses/types";
import { fmt } from "~/lib/i18n/format";
import { loc } from "~/lib/i18n/localized";
import { useLocale, useT } from "~/lib/i18n/useT";
import { Button, Input, Label, Select } from "~/components/ui";
import { type CourseTools, findingItemId, itemKind } from "~/lib/registry/courseActions";
import { SolveWith } from "./ItemTools";

export type { ReviewPanelAgent, ReviewPanelChoice };

type PanelFinding = NonNullable<ReviewPanelAgent["review"]>["findings"][number];

/** The outcome text or the activity/assessment title a finding is about. */
function itemLabel(data: CourseData, id: string): string | null {
  const outcome = data.outcomes.find((o) => o.id === id);
  if (outcome) return outcome.text;
  return [...data.activities, ...data.assessments].find((i) => i.id === id)?.title ?? null;
}

/**
 * "Beoordeling" on the course page (brief P21, 21.5): the role agents' advice per hat, with
 * Akkoord / Niet akkoord per finding. Plain forms, so it works without JS; the toast reports
 * the result, so there is no extra live region. Hats advise; nothing here changes the course.
 */
export function CourseReviewPanel({
  data,
  agents,
  choices,
  models,
  defaultModel,
  linkedTests = 0,
  courseId,
  tools,
}: {
  data: CourseData;
  /** The reviews of the hats the teacher chose. */
  agents: ReviewPanelAgent[];
  /** Every hat the admin has on; the teacher ticks which ones look along. */
  choices: ReviewPanelChoice[];
  models: { id: string; displayName: string }[];
  defaultModel: string;
  /** Linked test-question generations; the "also review" box shows only when there are any. */
  linkedTests?: number;
  /** With both, an open finding about an item gets "Los op met…" (P27.4). */
  courseId?: string;
  tools?: CourseTools;
}) {
  const p = useT().agents.panel;
  const locale = useLocale();
  const id = useId();
  const [ticked, setTicked] = useState(
    () => new Set(choices.filter((c) => c.chosen).map((c) => c.agentId)),
  );
  const toggle = (agentId: string, on: boolean) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {p.title}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {agents.length === 0
          ? p.introNone
          : fmt(p.intro, {
              roles: new Intl.ListFormat(locale, { type: "conjunction" }).format(
                agents.map((a) => loc(a.role, locale)),
              ),
            })}
      </p>
      <Form method="post" className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="agentsChosen" value="1" />
        <fieldset className="basis-full">
          <legend className="text-sm font-medium text-slate-900">{p.chooseLegend}</legend>
          <ul className="mt-2 space-y-2">
            {choices.map((c) => (
              <li key={c.agentId}>
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="agent"
                    value={c.agentId}
                    checked={ticked.has(c.agentId)}
                    onChange={(e) => toggle(c.agentId, e.currentTarget.checked)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-slate-900">{loc(c.role, locale)}</span>
                    <span className="block text-slate-600">{loc(c.focus, locale)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            <Link
              to="/help/review-team"
              className="text-violet-700 underline focus-visible:outline-2 focus-visible:outline-violet-500"
            >
              {p.chooseMore}
            </Link>
          </p>
        </fieldset>
        {models.length > 1 && (
          <div>
            <Label htmlFor={`${id}-model`}>{p.model}</Label>
            <Select id={`${id}-model`} name="model" defaultValue={defaultModel} className="mt-1">
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </Select>
          </div>
        )}
        {linkedTests > 0 && (
          <label className="flex basis-full items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="includeLinked" value="1" />
            {fmt(p.includeLinked, { n: linkedTests })}
          </label>
        )}
        <Button type="submit" name="intent" value="review" disabled={ticked.size === 0}>
          {p.run}
        </Button>
        {ticked.size === 0 && <p className="basis-full text-sm text-slate-700">{p.chooseNone}</p>}
      </Form>
      <div className="mt-4 space-y-6">
        {agents.map((agent) => (
          <AgentReview
            key={agent.agentId}
            agent={agent}
            data={data}
            role={loc(agent.role, locale)}
            solve={courseId && tools ? { courseId, tools } : null}
          />
        ))}
      </div>
    </section>
  );
}

function AgentReview({
  agent,
  data,
  role,
  solve,
}: {
  agent: ReviewPanelAgent;
  data: CourseData;
  role: string;
  solve: { courseId: string; tools: CourseTools } | null;
}) {
  const p = useT().agents.panel;
  const id = useId();
  const review = agent.review;
  const open = review?.findings.filter((f) => !f.decision) ?? [];
  const decided = review?.findings.filter((f) => f.decision) ?? [];
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="font-medium text-slate-900">
        {role}
      </h3>
      {!review ? (
        <p className="mt-1 text-sm text-slate-600">{p.notYet}</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-slate-500">
            {fmt(p.reviewedWith, { model: review.model })}
          </p>
          {review.stale && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm text-amber-900">
              {p.stale}
            </p>
          )}
          {review.findings.length === 0 && <p className="mt-2 text-sm text-slate-700">{p.none}</p>}
          {open.length > 0 && (
            <ul className="mt-2 space-y-2">
              {open.map((f) => (
                <OpenFinding
                  key={f.id}
                  finding={f}
                  reviewId={review.id}
                  data={data}
                  solve={solve}
                />
              ))}
            </ul>
          )}
          {decided.length > 0 && (
            <details className="mt-2 [&[open]>summary]:mb-2">
              <summary className="cursor-pointer text-sm font-medium text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-500">
                {fmt(p.decided, { n: decided.length })}
              </summary>
              <ul className="space-y-2">
                {decided.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"
                  >
                    <FindingBody finding={f} data={data} />
                    <p className="mt-1">
                      <strong className="font-medium">
                        {p.decision[f.decision ?? "accepted"]}
                      </strong>
                      {f.reason ? `: ${f.reason}` : null}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}

function FindingBody({ finding, data }: { finding: ReviewFinding; data: CourseData }) {
  const p = useT().agents.panel;
  const item = finding.targetId ? itemLabel(data, finding.targetId) : null;
  return (
    <div className="flex items-start gap-2">
      {finding.severity === "warning" ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      ) : (
        <Info className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
      )}
      <div>
        <p className="text-xs text-slate-500">{item ? fmt(p.about, { item }) : p.wholeCourse}</p>
        <p>
          <strong className="font-medium">{p.severity[finding.severity]}:</strong> {finding.message}
        </p>
        {finding.suggestion && (
          <p className="mt-1">
            <span className="font-medium">{p.suggestion}:</span> {finding.suggestion}
          </p>
        )}
      </div>
    </div>
  );
}

/** "Los op met…" (P27.4): the first tool for the kind of item the finding is about. */
function SolveFinding({
  finding,
  data,
  courseId,
  tools,
}: {
  finding: ReviewFinding;
  data: CourseData;
  courseId: string;
  tools: CourseTools;
}) {
  const kind = finding.targetId ? itemKind(data, finding.targetId) : null;
  const tool = kind ? tools[kind][0] : undefined;
  if (!tool) return null;
  return (
    <SolveWith tool={tool} courseId={courseId} itemId={findingItemId(data, finding.targetId)} />
  );
}

function OpenFinding({
  finding,
  reviewId,
  data,
  solve = null,
}: {
  finding: PanelFinding;
  reviewId: string;
  data: CourseData;
  solve?: { courseId: string; tools: CourseTools } | null;
}) {
  const p = useT().agents.panel;
  const id = useId();
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
      <div id={`${id}-body`}>
        <FindingBody finding={finding} data={data} />
      </div>
      {solve && <SolveFinding finding={finding} data={data} {...solve} />}
      <Form method="post" className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="intent" value="decide" />
        <input type="hidden" name="reviewId" value={reviewId} />
        <input type="hidden" name="findingId" value={finding.id} />
        <div className="w-full sm:w-auto sm:flex-1">
          <Label htmlFor={`${id}-reason`}>{p.reason}</Label>
          <Input
            id={`${id}-reason`}
            name="reason"
            maxLength={DECISION_REASON_MAX}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            name="decision"
            value="accepted"
            aria-describedby={`${id}-body`}
          >
            {p.accept}
          </Button>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            name="decision"
            value="rejected"
            aria-describedby={`${id}-body`}
          >
            {p.reject}
          </Button>
        </div>
      </Form>
    </li>
  );
}
