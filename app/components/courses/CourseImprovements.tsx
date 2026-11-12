import { useId } from "react";
import { Form } from "react-router";
import { improvementPlace } from "~/lib/courses/improvements";
import { COURSE_LIMITS } from "~/lib/courses/schema";
import type { CourseData, Improvement } from "~/lib/courses/types";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { Button, Card, HelpText, Label, Select, Textarea } from "~/components/ui";

type Messages = ReturnType<typeof useT>["courseImprovements"];

/** An option label: long outcome texts are cut, the select stays usable. */
const short = (text: string) => (text.length > 90 ? `${text.slice(0, 87)}…` : text);

/** Where the point belongs, in words: "Toets: Eindopdracht", or the whole course. */
function placeText(data: CourseData, point: Improvement, m: Messages): string {
  const place = improvementPlace(data, point.place);
  if (place.kind === "course") return m.places.course;
  const name =
    place.kind === "outcome"
      ? data.outcomes.find((o) => o.id === place.id)?.text
      : [...data.activities, ...data.assessments].find((i) => i.id === place.id)?.title;
  return `${m.places[place.kind]}: ${short(name ?? "")}`;
}

function runText(point: Improvement, m: Messages): string | null {
  const run = [point.run?.studyYear, point.run?.phase].filter(Boolean).join(", ");
  return run ? fmt(m.run, { run }) : null;
}

/** One status or remove button; its description is the point it acts on. */
function PointButton({
  point,
  textId,
  intent,
  status,
  label,
  variant = "secondary",
}: {
  point: Improvement;
  textId: string;
  intent: "set-improvement-status" | "remove-improvement";
  status?: Improvement["status"];
  label: string;
  variant?: "secondary" | "ghost";
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={point.id} />
      {status && <input type="hidden" name="status" value={status} />}
      <Button type="submit" size="sm" variant={variant} aria-describedby={textId}>
        {label}
      </Button>
    </Form>
  );
}

function PointItem({ data, point, m }: { data: CourseData; point: Improvement; m: Messages }) {
  const textId = useId();
  const open = point.status === "open";
  const meta = [
    placeText(data, point, m),
    point.source === "evaluation" ? m.fromEvaluation : null,
    runText(point, m),
  ].filter(Boolean);
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
      <p id={textId}>{point.text}</p>
      <p className="mt-1 text-xs text-slate-600">{meta.join(" · ")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <PointButton
          point={point}
          textId={textId}
          intent="set-improvement-status"
          status={open ? "done" : "open"}
          label={open ? m.finish : m.reopen}
        />
        <PointButton
          point={point}
          textId={textId}
          intent="remove-improvement"
          label={m.remove}
          variant="ghost"
        />
      </div>
    </li>
  );
}

/** The select of places: the whole course, then each outcome, lesson and test by name. */
function PlaceSelect({ id, data, m }: { id: string; data: CourseData; m: Messages }) {
  const groups = [
    {
      label: m.places.outcomeGroup,
      kind: "outcome",
      items: data.outcomes.map((o) => ({ id: o.id, name: o.text })),
    },
    {
      label: m.places.activityGroup,
      kind: "activity",
      items: data.activities.map((a) => ({ id: a.id, name: a.title })),
    },
    {
      label: m.places.assessmentGroup,
      kind: "assessment",
      items: data.assessments.map((a) => ({ id: a.id, name: a.title })),
    },
  ].filter((g) => g.items.length > 0);
  return (
    <Select id={id} name="place" defaultValue="course" className="mt-1">
      <option value="course">{m.places.course}</option>
      {groups.map((g) => (
        <optgroup key={g.kind} label={g.label}>
          {g.items.map((i) => (
            <option key={i.id} value={`${g.kind}:${i.id}`}>
              {short(i.name)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

/**
 * "Verbeterpunten" on the Controle tab (brief P33.1): what the teacher wants to do differently
 * next run, each on its place in the course. Open points come along on a copy for a new run.
 * Saves are announced by the page's toast, not here.
 */
export function CourseImprovements({ data }: { data: CourseData }) {
  const m = useT().courseImprovements;
  const id = useId();
  const points = data.improvements ?? [];
  const open = points.filter((p) => p.status === "open");
  const done = points.filter((p) => p.status === "done");
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.heading}
      </h2>
      <p className="mt-1 max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
      {open.length === 0 ? (
        <p className="mt-3 text-sm text-slate-700">{m.none}</p>
      ) : (
        <ul aria-label={m.openList} className="mt-3 space-y-2">
          {open.map((p) => (
            <PointItem key={p.id} data={data} point={p} m={m} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            {fmt(m.doneSummary, { n: done.length })}
          </summary>
          <ul aria-label={m.doneList} className="mt-2 space-y-2">
            {done.map((p) => (
              <PointItem key={p.id} data={data} point={p} m={m} />
            ))}
          </ul>
        </details>
      )}
      <Card className="mt-4 p-4">
        <h3 className="text-base font-medium text-slate-900">{m.addHeading}</h3>
        <Form method="post" className="mt-3 space-y-3">
          <input type="hidden" name="intent" value="add-improvement" />
          <div>
            <Label htmlFor={`${id}-text`}>{m.text}</Label>
            <Textarea
              id={`${id}-text`}
              name="text"
              rows={2}
              required
              maxLength={COURSE_LIMITS.text}
              aria-describedby={`${id}-text-hint`}
              className="mt-1"
            />
            <HelpText id={`${id}-text-hint`}>{m.textHint}</HelpText>
          </div>
          <div>
            <Label htmlFor={`${id}-place`}>{m.place}</Label>
            <PlaceSelect id={`${id}-place`} data={data} m={m} />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            {m.add}
          </Button>
        </Form>
      </Card>
    </section>
  );
}
