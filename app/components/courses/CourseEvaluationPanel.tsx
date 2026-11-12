import { useEffect, useId, useRef, useState } from "react";
import { Form } from "react-router";
import { ShieldCheck } from "lucide-react";
import {
  emptyRedactDraft,
  RedactReview,
  type RedactDraft,
} from "~/components/privacy/RedactReview";
import { AiCallField } from "~/components/AiLeaveGuard";
import { FileInput } from "~/components/FileInput";
import { Button, Card, HelpText, Input, Label, Select, Textarea } from "~/components/ui";
import { type CourseEvaluation, EVALUATION_LIMITS, readSurveyCsv } from "~/lib/courses/evaluation";
import type { CourseData } from "~/lib/courses/types";
import { fmt } from "~/lib/i18n/format";
import { useT } from "~/lib/i18n/useT";
import { placeText } from "./CourseImprovements";

type Messages = ReturnType<typeof useT>["courseEvaluation"];

/** The input step: paste or a CSV, the respondents, then the name check. */
const FOCUSABLE = 'textarea, select, button, input:not([type="hidden"]), [tabindex="0"]';

function SurveyInput({
  text,
  respondents,
  onText,
  onRespondents,
  onCheck,
  m,
}: {
  text: string;
  respondents: string;
  onText: (v: string) => void;
  onRespondents: (v: string) => void;
  onCheck: () => void;
  m: Messages;
}) {
  const id = useId();
  async function readFile(file: File | undefined) {
    if (!file) return;
    const csv = readSurveyCsv(await file.text());
    onText(csv.answers);
    onRespondents(String(csv.respondents));
  }
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onCheck();
      }}
    >
      <div>
        <Label htmlFor={`${id}-text`}>{m.answers}</Label>
        <Textarea
          id={`${id}-text`}
          rows={6}
          required
          maxLength={EVALUATION_LIMITS.evaluation}
          value={text}
          onChange={(e) => onText(e.target.value)}
          aria-describedby={`${id}-text-hint`}
          className="mt-1"
        />
        <HelpText id={`${id}-text-hint`}>{m.answersHint}</HelpText>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${id}-csv`}>{m.csv}</Label>
          <FileInput
            id={`${id}-csv`}
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => void readFile(e.target.files?.[0])}
            aria-describedby={`${id}-csv-hint`}
            className="mt-1"
          />
          <HelpText id={`${id}-csv-hint`}>{m.csvHint}</HelpText>
        </div>
        <div>
          <Label htmlFor={`${id}-n`}>{m.respondents}</Label>
          <Input
            id={`${id}-n`}
            type="number"
            min={1}
            max={EVALUATION_LIMITS.respondents}
            required
            value={respondents}
            onChange={(e) => onRespondents(e.target.value)}
            aria-describedby={`${id}-n-hint`}
            className="mt-1"
          />
          <HelpText id={`${id}-n-hint`}>{m.respondentsHint}</HelpText>
        </div>
      </div>
      <Button type="submit" size="sm" variant="secondary">
        <ShieldCheck className="size-4" aria-hidden /> {m.check}
      </Button>
    </form>
  );
}

/** One improvement with Akkoord (adds it to the course) and Niet akkoord (it goes, unsaved). */
function Proposal({
  data,
  point,
  onDecided,
  m,
  places,
}: {
  data: CourseData;
  point: CourseEvaluation["improvements"][number];
  onDecided: () => void;
  m: Messages;
  places: ReturnType<typeof useT>["courseImprovements"]["places"];
}) {
  const textId = useId();
  const place = point.place.kind === "course" ? "course" : `${point.place.kind}:${point.place.id}`;
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">
      <p id={textId}>{point.text}</p>
      <p className="mt-1 text-xs text-slate-600">{placeText(data, point.place, { places })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Form method="post" onSubmit={onDecided}>
          <input type="hidden" name="intent" value="add-improvement" />
          <input type="hidden" name="source" value="evaluation" />
          <input type="hidden" name="text" value={point.text} />
          <input type="hidden" name="place" value={place} />
          <Button type="submit" size="sm" variant="secondary" aria-describedby={textId}>
            {m.accept}
          </Button>
        </Form>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-describedby={textId}
          onClick={onDecided}
        >
          {m.reject}
        </Button>
      </div>
    </li>
  );
}

/** The three blocks of a processed evaluation. */
function EvaluationResult({ data, result }: { data: CourseData; result: CourseEvaluation }) {
  const t = useT();
  const m = t.courseEvaluation;
  const places = t.courseImprovements.places;
  const id = useId();
  const [decided, setDecided] = useState<number[]>([]);
  // A decided point leaves the list: focus the next one, or the heading when none is left.
  const betterRef = useRef<HTMLElement>(null);
  const seen = useRef(0);
  useEffect(() => {
    if (decided.length === seen.current) return;
    seen.current = decided.length;
    const next =
      betterRef.current?.querySelector<HTMLElement>("li button") ??
      betterRef.current?.querySelector<HTMLElement>("h3");
    next?.focus();
  }, [decided]);
  const open = result.improvements.flatMap((p, i) => (decided.includes(i) ? [] : [{ p, i }]));
  const themes = (polarity: "positive" | "negative") =>
    result.themes.filter((th) => th.polarity === polarity);
  return (
    <div className="mt-6 space-y-6">
      {result.small && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{m.small}</p>
      )}
      <section aria-labelledby={`${id}-said`}>
        <h3 id={`${id}-said`} className="text-base font-medium text-slate-900">
          {m.said}
        </h3>
        {result.themes.length === 0 && <p className="mt-2 text-sm text-slate-700">{m.none}</p>}
        {(["negative", "positive"] as const).map(
          (polarity) =>
            themes(polarity).length > 0 && (
              <div key={polarity} className="mt-2">
                <h4 className="text-sm font-medium text-slate-800">{m[polarity]}</h4>
                <ul className="mt-1 space-y-2">
                  {themes(polarity).map((th) => (
                    <li key={th.label} className="text-sm text-slate-800">
                      <strong className="font-medium">{th.label}</strong>{" "}
                      <span className="text-slate-600">
                        ({fmt(m.count, { n: th.count, total: result.respondents })})
                      </span>
                      {th.quotes.map((q) => (
                        <blockquote
                          key={q}
                          className="mt-1 border-l-2 border-slate-300 pl-3 text-slate-700"
                        >
                          {q}
                        </blockquote>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            ),
        )}
      </section>
      <section aria-labelledby={`${id}-wrong`}>
        <h3 id={`${id}-wrong`} className="text-base font-medium text-slate-900">
          {m.wrong}
        </h3>
        {result.problems.length === 0 ? (
          <p className="mt-2 text-sm text-slate-700">{m.none}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {result.problems.map((p) => (
              <li key={`${p.text}`} className="text-sm text-slate-800">
                <p>{p.text}</p>
                <p className="mt-0.5 text-xs text-slate-600">
                  {placeText(data, p.place, { places })} · {m.basis[p.basis]}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section ref={betterRef} aria-labelledby={`${id}-better`}>
        <h3 id={`${id}-better`} tabIndex={-1} className="text-base font-medium text-slate-900">
          {m.better}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{m.betterIntro}</p>
        {open.length > 0 && (
          <ul className="mt-2 space-y-2">
            {open.map(({ p, i }) => (
              <Proposal
                key={i}
                data={data}
                point={p}
                m={m}
                places={places}
                onDecided={() => setDecided((d) => [...d, i])}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * "Cursusevaluatie verwerken" on the Controle tab (brief P33.3): the survey is pasted or read
 * from a CSV in the browser, goes through the name check (`RedactReview`) before anything leaves,
 * and is processed by `evaluate-course`. The result is advice: only an improvement the teacher
 * accepts reaches the course. The page's toast announces the processing and the saves.
 */
export function CourseEvaluationPanel({
  data,
  result,
  models = [],
}: {
  data: CourseData;
  /** The last processed evaluation from the page's action, if any. */
  result: CourseEvaluation | null;
  /** The models the teacher may choose; a choice is offered with more than one. */
  models?: { id: string; displayName: string }[];
}) {
  const m = useT().courseEvaluation;
  const id = useId();
  const [text, setText] = useState("");
  const [respondents, setRespondents] = useState("");
  const [step, setStep] = useState<"input" | "check" | "ready">("input");
  // A step replaces the button that led to it: move focus to the new step's first control.
  const stepRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    stepRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [step]);
  const [draft, setDraft] = useState<RedactDraft>(emptyRedactDraft);
  const [redacted, setRedacted] = useState("");
  // The result stays while the teacher accepts points (each accept is a new action).
  const [shown, setShown] = useState(result);
  const [last, setLast] = useState(result);
  // Each new result starts with no decisions taken.
  const [round, setRound] = useState(0);
  if (result !== last) {
    setLast(result);
    if (result) {
      setShown(result);
      setRound((n) => n + 1);
    }
  }

  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-medium text-slate-900">
        {m.heading}
      </h2>
      <Card className="mt-3 p-4">
        <p className="max-w-[65ch] text-sm text-slate-600">{m.intro}</p>
        <div ref={stepRef}>
          {step === "input" && (
            <SurveyInput
              text={text}
              respondents={respondents}
              onText={setText}
              onRespondents={setRespondents}
              onCheck={() => setStep("check")}
              m={m}
            />
          )}
          {step === "check" && (
            <div className="mt-4">
              <RedactReview
                fields={[{ name: "evaluation", label: m.field, text }]}
                draft={draft}
                onDraft={setDraft}
                onConfirm={(r) => {
                  setRedacted(r.values.evaluation ?? "");
                  setStep("ready");
                }}
                onCancel={() => setStep("input")}
              />
            </div>
          )}
          {step === "ready" && (
            <Form method="post" className="mt-4 space-y-3">
              <p className="flex items-center gap-2 text-sm text-slate-700">
                <ShieldCheck className="size-4 text-violet-700" aria-hidden /> {m.checked}
              </p>
              <input type="hidden" name="intent" value="evaluate-course" />
              <AiCallField />
              <input type="hidden" name="evaluation" value={redacted} />
              <input type="hidden" name="respondents" value={respondents} />
              {models.length > 1 && (
                <div className="max-w-xs">
                  <Label htmlFor={`${id}-model`}>{m.model}</Label>
                  <Select id={`${id}-model`} name="model" className="mt-1">
                    {models.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.displayName}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm">
                  {m.process}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStep("input")}
                >
                  {m.edit}
                </Button>
              </div>
            </Form>
          )}
        </div>
        {shown && <EvaluationResult key={round} data={data} result={shown} />}
      </Card>
    </section>
  );
}
